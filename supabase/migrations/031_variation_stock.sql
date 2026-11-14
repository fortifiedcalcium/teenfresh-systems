-- 031: Stock for variations. Run AFTER 030_variation_layers.sql.
-- A variation can have a stock count (empty = not counted, always available). Placing an order takes the quantity out of the stock, and a
-- version with too few left cannot be bought (OUT_OF_STOCK); the whole order is refused, so nothing is half-taken. Cancelling or deleting an order
-- puts its quantities back. Counts of 0 mean sold out.

alter table public.product_variations add column if not exists stock integer check (stock is null or stock >= 0);

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
    -- a counted version: take what is bought out of the stock in the same step that checks it, so two orders can never both get the last one
    if vr.id is not null and vr.stock is not null then
      update public.product_variations set stock = stock - q where id = vr.id and stock >= q;
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

-- put the stock back when an order is cancelled, or deleted while it was still live (the sale no longer counts)
create or replace function public.restore_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  update public.product_variations v set stock = v.stock + s.q
    from (select variation_id, sum(quantity)::int as q from public.order_items where order_id = v_order and variation_id is not null group by variation_id) s
   where v.id = s.variation_id and v.stock is not null;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.restore_stock() from public, anon, authenticated;

drop trigger if exists orders_restore_stock_cancel on public.orders;
drop trigger if exists orders_restore_stock_delete on public.orders;
create trigger orders_restore_stock_cancel after update of status on public.orders for each row when (new.status = 'cancelled' and old.status <> 'cancelled') execute function public.restore_stock();
create trigger orders_restore_stock_delete before delete on public.orders for each row when (old.status <> 'cancelled') execute function public.restore_stock();
