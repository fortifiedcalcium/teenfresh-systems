-- 029: Product variations (versions, sizes, colours ...). Run AFTER 028_admin_delete_orders.sql.
-- A product can have variations, each with a name and, optionally, its own price (otherwise the product's price is used).
-- When a product has active variations the shopper must pick one; the order keeps its name and the price it was bought at.

create table if not exists public.product_variations (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  price      numeric(10,2) check (price is null or price > 0),            -- null = the product's price
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists product_variations_name_key on public.product_variations (product_id, lower(name));
create index if not exists product_variations_product_idx on public.product_variations (product_id, position);

alter table public.product_variations enable row level security;
drop policy if exists product_variations_public_read on public.product_variations;
drop policy if exists product_variations_admin_all on public.product_variations;
create policy product_variations_public_read on public.product_variations for select to anon, authenticated using (active and exists (select 1 from public.products p where p.id = product_id and p.active));
create policy product_variations_admin_all   on public.product_variations for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.order_items add column if not exists variation_id   uuid references public.product_variations (id) on delete set null;
alter table public.order_items add column if not exists variation_name text;

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
  v_sub   numeric(12,2) := 0;
  v_id    uuid;
  v_num   text;
  it      jsonb;
  pr      public.products;
  vr      public.product_variations;
  v_price numeric(12,2);
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
  if public.reference_in_use(v_ref) then raise exception 'DUPLICATE_REFERENCE'; end if;

  select * into v_set from public.shop_settings where id;
  if v_set.gcash_account_number is null or btrim(v_set.gcash_account_number) = '' then raise exception 'PAYMENT_NOT_SET_UP'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    q := case when (it ->> 'quantity') ~ '^[0-9]{1,2}$' then (it ->> 'quantity')::int else 0 end;
    if q not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into pr from public.products where id::text = it ->> 'product_id' and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    vr := null;
    if exists (select 1 from public.product_variations where product_id = pr.id and active) then        -- the shopper must pick one of the product's versions
      select * into vr from public.product_variations where id::text = it ->> 'variation_id' and product_id = pr.id and active;
      if not found then raise exception 'VARIATION_REQUIRED'; end if;
    end if;
    v_price := coalesce(vr.price, pr.price);
    v_sub := v_sub + v_price * q;
  end loop;
  v_num := 'TF-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders (order_number, user_id, name, email, phone, address, city, postal_code, notes, subtotal_php, shipping_php, total_php, sender_name, reference_number, receipt_path, shipping_status)
  values (v_num, v_uid, btrim(p_name), btrim(p_email), v_phone, btrim(p_address), btrim(p_city), p_postal, nullif(btrim(coalesce(p_notes, '')), ''), v_sub, 0, v_sub, btrim(p_sender), v_ref, p_receipt_path, 'none')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id::text = it ->> 'product_id';
    vr := null;
    select * into vr from public.product_variations where id::text = it ->> 'variation_id' and product_id = pr.id and active;
    insert into public.order_items (order_id, product_id, variation_id, variation_name, artist, title, unit_price_php, quantity)
    values (v_id, pr.id, vr.id, vr.name, pr.artist, pr.title, coalesce(vr.price, pr.price), (it ->> 'quantity')::int);
  end loop;
  return jsonb_build_object('id', v_id, 'order_number', v_num, 'total_php', v_sub);
end $$;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  ignore text[] := array['id', 'created_at', 'updated_at', 'event_id', 'user_id', 'description', 'html_body', 'text_body', 'subject', 'terms_html', 'receipt_deleted_at', 'receipt_history', 'reference_history'];
  redact text[] := array['name', 'x_username', 'email', 'contact_number', 'facebook_url', 'sender_name', 'reference_number', 'receipt_path', 'notes', 'phone',
                         'address', 'city', 'postal_code', 'shipping_sender_name', 'shipping_reference_number', 'shipping_receipt_path',
                         'balance_sender_name', 'balance_reference_number', 'balance_receipt_path', 'balance_references', 'admin_note',
                         'info_description', 'info_specs', 'info_shipping', 'info_notes', 'body'];   -- long texts say only that they changed
  k text;
  diff jsonb := '{}'::jsonb;
  ov jsonb; nv jsonb;
  v_actor uuid := auth.uid();
  v_label text;
  v_event uuid;
begin
  for k in select jsonb_object_keys(r) loop
    continue when k = any(ignore);
    ov := o -> k; nv := n -> k;
    if tg_op = 'UPDATE' and ov is not distinct from nv then continue; end if;
    if k = any(redact) then
      diff := diff || jsonb_build_object(k, '[changed]');
    elsif tg_op = 'UPDATE' then
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', left(ov #>> '{}', 200), 'new', left(nv #>> '{}', 200)));
    else
      diff := diff || jsonb_build_object(k, left(r -> k #>> '{}', 200));
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then return null; end if;   -- only ignored columns changed

  v_label := case tg_table_name
    when 'events' then r ->> 'title'
    when 'event_kits' then r ->> 'name'
    when 'registrations' then coalesce(r ->> 'ticket_number', 'registration ' || left(r ->> 'id', 8))
    when 'email_templates' then r ->> 'kind'
    when 'profiles' then r ->> 'email'
    when 'payments' then 'payment ' || left(r ->> 'id', 8)
    when 'products' then (r ->> 'artist') || ': ' || (r ->> 'title')
    when 'product_variations' then 'variation ' || (r ->> 'name') || ' of ' || coalesce((select title from public.products where id = (r ->> 'product_id')::uuid), 'a product')
    when 'product_categories' then r ->> 'name'
    when 'couriers' then r ->> 'name'
    when 'shop_settings' then 'checkout settings'
    when 'orders' then 'order ' || (r ->> 'order_number')
    when 'order_email_templates' then r ->> 'kind'
  end;
  v_event := case tg_table_name when 'events' then (r ->> 'id')::uuid else nullif(r ->> 'event_id', '')::uuid end;

  insert into public.change_log (actor_id, actor_email, table_name, row_id, event_id, action, label, changes)
  values (v_actor, (select email from public.profiles where id = v_actor), tg_table_name, r ->> 'id', v_event, lower(tg_op), v_label, diff);
  return null;
end $$;

drop trigger if exists product_variations_log on public.product_variations;
create trigger product_variations_log after insert or update or delete on public.product_variations for each row execute function public.log_change();
