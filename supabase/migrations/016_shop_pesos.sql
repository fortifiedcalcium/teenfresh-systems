-- 016: The shop prices products directly in Philippine pesos. Run AFTER 015_shop_gcash_qr.sql.
-- * products.price is now in PESOS. Existing prices are converted ONCE, at the current rate, so shoppers pay the same peso amount as before.
-- * Orders and order lines get peso columns (backfilled from the old dollar columns and the rate saved on each order).
--   The old dollar columns stay on past orders as history; new orders leave them empty.
-- * The exchange rate setting is removed. place_order() now just adds up peso prices and the shipping fee.
-- Safe to run more than once: the conversion only happens while shop_settings.usd_to_php still exists.

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shop_settings' and column_name = 'usd_to_php') then
    update public.products set price = greatest(round(price * (select usd_to_php from public.shop_settings where id), 2), 0.01), updated_at = now();
  end if;
end $$;

alter table public.orders      add column if not exists subtotal_php   numeric(12,2);
alter table public.order_items add column if not exists unit_price_php numeric(10,2);
update public.orders      set subtotal_php   = round(subtotal_usd * usd_to_php, 2) where subtotal_php is null and subtotal_usd is not null;
update public.order_items i set unit_price_php = round(i.unit_price_usd * o.usd_to_php, 2) from public.orders o where o.id = i.order_id and i.unit_price_php is null and i.unit_price_usd is not null;
alter table public.orders      alter column subtotal_php   set not null;
alter table public.order_items alter column unit_price_php set not null;
alter table public.orders      alter column subtotal_usd drop not null;
alter table public.orders      alter column usd_to_php   drop not null;
alter table public.order_items alter column unit_price_usd drop not null;

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

  -- price every line from the products table (pesos)
  for it in select * from jsonb_array_elements(p_items) loop
    q := case when (it ->> 'quantity') ~ '^[0-9]{1,2}$' then (it ->> 'quantity')::int else 0 end;
    if q not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into pr from public.products where id::text = it ->> 'product_id' and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_sub := v_sub + pr.price * q;
  end loop;
  v_total := v_sub + v_set.shipping_fee_php;
  v_num := 'TF-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders (order_number, user_id, name, email, phone, address, city, postal_code, notes, subtotal_php, shipping_php, total_php, sender_name, reference_number, receipt_path)
  values (v_num, v_uid, btrim(p_name), btrim(p_email), v_phone, btrim(p_address), btrim(p_city), p_postal, nullif(btrim(coalesce(p_notes, '')), ''), v_sub, v_set.shipping_fee_php, v_total, btrim(p_sender), v_ref, p_receipt_path)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id::text = it ->> 'product_id';
    insert into public.order_items (order_id, product_id, artist, title, unit_price_php, quantity)
    values (v_id, pr.id, pr.artist, pr.title, pr.price, (it ->> 'quantity')::int);
  end loop;
  return jsonb_build_object('id', v_id, 'order_number', v_num, 'total_php', v_total);
end $$;

alter table public.shop_settings drop column if exists usd_to_php;
