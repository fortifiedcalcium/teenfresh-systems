-- 011: Shop checkout: settings, orders and the place_order function. Run AFTER 010_products.sql.
-- Prices are kept in US dollars on products. At checkout they are converted to pesos at the rate in shop_settings,
-- and the rate is saved on the order. Payment is a GCash transfer with a receipt that an admin checks by hand.
-- Orders are created ONLY by place_order(), which reads prices from the products table and ignores any price the browser sends.

create table if not exists public.shop_settings (
  id                    boolean primary key default true check (id),      -- one row only
  usd_to_php            numeric(8,2)  not null default 58 check (usd_to_php > 0),
  shipping_fee_php      numeric(10,2) not null default 0 check (shipping_fee_php >= 0),
  gcash_account_name    text,
  gcash_account_number  text,
  updated_at            timestamptz not null default now()
);
insert into public.shop_settings (id) values (true) on conflict do nothing;

create sequence if not exists public.order_number_seq;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  email            text not null,
  phone            text not null,
  address          text not null,
  city             text not null,
  postal_code      text not null,
  notes            text,
  subtotal_usd     numeric(10,2) not null check (subtotal_usd > 0),
  usd_to_php       numeric(8,2)  not null check (usd_to_php > 0),
  shipping_php     numeric(10,2) not null default 0 check (shipping_php >= 0),
  total_php        numeric(12,2) not null check (total_php > 0),
  sender_name      text not null,
  reference_number text not null,
  receipt_path     text,
  status           text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
-- one GCash reference can pay for one live order only
create unique index if not exists orders_reference_key on public.orders (public.normalize_reference(reference_number)) where status <> 'cancelled';

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,
  artist          text not null,
  title           text not null,
  unit_price_usd  numeric(10,2) not null check (unit_price_usd > 0),
  quantity        integer not null check (quantity between 1 and 10)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.shop_settings enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;

drop policy if exists shop_settings_read on public.shop_settings;
drop policy if exists shop_settings_admin on public.shop_settings;
drop policy if exists orders_read on public.orders;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists order_items_read on public.order_items;
create policy shop_settings_read  on public.shop_settings for select to anon, authenticated using (true);
create policy shop_settings_admin on public.shop_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- people read their own orders, admins read all; nobody inserts directly (place_order does), only admins update
create policy orders_read         on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_read    on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create or replace function public.place_order(
  p_items jsonb, p_name text, p_email text, p_phone text, p_address text, p_city text, p_postal text, p_notes text,
  p_sender text, p_reference text, p_receipt_path text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_phone text := public.normalize_phone(p_phone);
  v_ref   text := regexp_replace(coalesce(p_reference, ''), '\s', '', 'g');
  v_set   public.shop_settings;
  v_sub   numeric(10,2) := 0;
  v_total numeric(12,2);
  v_id    uuid;
  v_num   text;
  it      jsonb;
  pr      public.products;
  q       integer;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'INVALID_NAME'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(btrim(coalesce(p_address, ''))) not between 1 and 300 then raise exception 'INVALID_ADDRESS'; end if;
  if char_length(btrim(coalesce(p_city, ''))) not between 1 and 100 then raise exception 'INVALID_ADDRESS'; end if;
  if coalesce(p_postal, '') !~ '^[0-9]{4}$' then raise exception 'INVALID_POSTAL'; end if;
  if char_length(btrim(coalesce(p_sender, ''))) not between 1 and 120 then raise exception 'INVALID_SENDER'; end if;
  if char_length(v_ref) not between 1 and 64 then raise exception 'INVALID_REFERENCE'; end if;
  if not public.valid_receipt_path(p_receipt_path, v_uid) then raise exception 'INVALID_RECEIPT'; end if;
  if exists (select 1 from public.orders where status <> 'cancelled' and public.normalize_reference(reference_number) = public.normalize_reference(v_ref)) then raise exception 'DUPLICATE_REFERENCE'; end if;

  select * into v_set from public.shop_settings where id;
  if v_set.gcash_account_number is null or btrim(v_set.gcash_account_number) = '' then raise exception 'PAYMENT_NOT_SET_UP'; end if;

  -- price every line from the products table
  for it in select * from jsonb_array_elements(p_items) loop
    q := case when (it ->> 'quantity') ~ '^[0-9]{1,2}$' then (it ->> 'quantity')::int else 0 end;
    if q not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into pr from public.products where id::text = it ->> 'product_id' and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_sub := v_sub + pr.price * q;
  end loop;
  v_total := round(v_sub * v_set.usd_to_php, 2) + v_set.shipping_fee_php;
  v_num := 'TF-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders (order_number, user_id, name, email, phone, address, city, postal_code, notes, subtotal_usd, usd_to_php, shipping_php, total_php, sender_name, reference_number, receipt_path)
  values (v_num, v_uid, btrim(p_name), btrim(p_email), v_phone, btrim(p_address), btrim(p_city), p_postal, nullif(btrim(coalesce(p_notes, '')), ''), v_sub, v_set.usd_to_php, v_set.shipping_fee_php, v_total, btrim(p_sender), v_ref, p_receipt_path)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id::text = it ->> 'product_id';
    insert into public.order_items (order_id, product_id, artist, title, unit_price_usd, quantity)
    values (v_id, pr.id, pr.artist, pr.title, pr.price, (it ->> 'quantity')::int);
  end loop;
  return jsonb_build_object('id', v_id, 'order_number', v_num, 'total_php', v_total);
end $$;
