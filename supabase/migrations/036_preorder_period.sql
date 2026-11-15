-- 036: Pre-order period. Run AFTER 035_product_stock.sql. It replaces place_order().
-- A pre-order product can have a start date and an end date (whole days, in Philippine time, Asia/Manila; the end date is the last day it can be
-- ordered). Before the start (PREORDER_NOT_STARTED) and after the end (PREORDER_ENDED) place_order() refuses the whole order. Empty dates mean
-- no limit. The shop shows the Pre-order badge while it is open, and a "Pre-order period ended" label with Add to cart switched off afterwards.

alter table public.products add column if not exists pre_order_starts_on date;
alter table public.products add column if not exists pre_order_ends_on   date;
alter table public.products drop constraint if exists products_pre_order_period;
alter table public.products add constraint products_pre_order_period check (pre_order_starts_on is null or pre_order_ends_on is null or pre_order_ends_on >= pre_order_starts_on);

-- today's date in Manila
create or replace function public.manila_today() returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

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
    -- a pre-order only sells inside its period, counted in Philippine time (Asia/Manila)
    if pr.pre_order then
      if pr.pre_order_starts_on is not null and public.manila_today() < pr.pre_order_starts_on then raise exception 'PREORDER_NOT_STARTED'; end if;
      if pr.pre_order_ends_on is not null and public.manila_today() > pr.pre_order_ends_on then raise exception 'PREORDER_ENDED'; end if;
    end if;
    vr := null;
    if exists (select 1 from public.product_variations where product_id = pr.id and active) then        -- the shopper must pick one of the product's versions
      select * into vr from public.product_variations where id::text = it ->> 'variation_id' and product_id = pr.id and active;
      if not found then raise exception 'VARIATION_REQUIRED'; end if;
    end if;
    v_price := coalesce(vr.price, pr.price);
    -- a counted version: take what is bought out of the stock in the same step that checks it, so two orders can never both get the last one
    if vr.id is not null then
      if vr.stock is not null then
        update public.product_variations set stock = stock - q where id = vr.id and stock >= q;
        if not found then raise exception 'OUT_OF_STOCK'; end if;
      end if;
    elsif pr.stock is not null then                      -- a product without versions keeps its own count
      update public.products set stock = stock - q where id = pr.id and stock >= q;
      if not found then raise exception 'OUT_OF_STOCK'; end if;
    end if;
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

