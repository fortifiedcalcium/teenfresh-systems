-- 018: Shipping is paid separately, after the order is confirmed. Run AFTER 017_product_info_images.sql.
-- New flow:  1) the shopper pays for the ITEMS at checkout (no shipping fee yet)
--            2) an admin checks that payment and marks the order paid
--            3) the admin sets the shipping fee for that order  -> the shopper is emailed
--            4) the shopper pays the shipping fee by GCash and uploads a receipt
--            5) the admin checks the shipping receipt, then the order can be marked shipped
-- Orders placed before this migration already paid any shipping with the order, so they are marked 'paid' and skip steps 3 to 5.
-- shipping_php (old, part of total_php) is only used by those older orders. The new fee lives in shipping_fee_php.

alter table public.orders
  add column if not exists shipping_status           text not null default 'none' check (shipping_status in ('none', 'awaiting_payment', 'pending_review', 'paid')),
  add column if not exists shipping_fee_php          numeric(10,2) check (shipping_fee_php is null or shipping_fee_php >= 0),
  add column if not exists shipping_sender_name      text,
  add column if not exists shipping_reference_number text,
  add column if not exists shipping_receipt_path     text,
  add column if not exists shipping_note             text;       -- why an admin sent a shipping receipt back

update public.orders set shipping_status = 'paid' where shipping_status = 'none' and shipping_fee_php is null;   -- runs once: older orders

alter table public.orders drop constraint if exists orders_ship_after_shipping_paid;
alter table public.orders add constraint orders_ship_after_shipping_paid check (status <> 'shipped' or shipping_status = 'paid');
create unique index if not exists orders_shipping_reference_key on public.orders (public.normalize_reference(shipping_reference_number))
  where shipping_reference_number is not null and status <> 'cancelled';

-- a new email: "pay your shipping fee"
alter table public.order_emails drop constraint if exists order_emails_kind_check;
alter table public.order_emails add constraint order_emails_kind_check check (kind in ('order_received', 'order_paid', 'order_shipping_due', 'order_shipped', 'order_cancelled'));
alter table public.order_email_templates drop constraint if exists order_email_templates_kind_check;
alter table public.order_email_templates add constraint order_email_templates_kind_check check (kind in ('order_received', 'order_paid', 'order_shipping_due', 'order_shipped', 'order_cancelled'));

-- New orders are charged for the items only; the shipping fee comes later.
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
  if exists (select 1 from public.orders where status <> 'cancelled'
             and (public.normalize_reference(reference_number) = public.normalize_reference(v_ref)
               or public.normalize_reference(shipping_reference_number) = public.normalize_reference(v_ref))) then raise exception 'DUPLICATE_REFERENCE'; end if;

  select * into v_set from public.shop_settings where id;
  if v_set.gcash_account_number is null or btrim(v_set.gcash_account_number) = '' then raise exception 'PAYMENT_NOT_SET_UP'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    q := case when (it ->> 'quantity') ~ '^[0-9]{1,2}$' then (it ->> 'quantity')::int else 0 end;
    if q not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into pr from public.products where id::text = it ->> 'product_id' and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_sub := v_sub + pr.price * q;
  end loop;
  v_num := 'TF-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders (order_number, user_id, name, email, phone, address, city, postal_code, notes, subtotal_php, shipping_php, total_php, sender_name, reference_number, receipt_path, shipping_status)
  values (v_num, v_uid, btrim(p_name), btrim(p_email), v_phone, btrim(p_address), btrim(p_city), p_postal, nullif(btrim(coalesce(p_notes, '')), ''), v_sub, 0, v_sub, btrim(p_sender), v_ref, p_receipt_path, 'none')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.products where id::text = it ->> 'product_id';
    insert into public.order_items (order_id, product_id, artist, title, unit_price_php, quantity)
    values (v_id, pr.id, pr.artist, pr.title, pr.price, (it ->> 'quantity')::int);
  end loop;
  return jsonb_build_object('id', v_id, 'order_number', v_num, 'total_php', v_sub);
end $$;

-- Admin: set (or change) the shipping fee of a confirmed order. 0 means free shipping. Locked once the shopper has sent a receipt.
create or replace function public.set_order_shipping(p_order uuid, p_fee numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_status text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'paid' then raise exception 'ORDER_NOT_PAID'; end if;
  if o.shipping_status in ('pending_review', 'paid') then raise exception 'SHIPPING_LOCKED'; end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then raise exception 'INVALID_FEE'; end if;
  v_status := case when p_fee = 0 then 'paid' else 'awaiting_payment' end;
  update public.orders set shipping_fee_php = round(p_fee, 2), shipping_status = v_status, shipping_note = null, updated_at = now() where id = p_order;
  return jsonb_build_object('shipping_fee_php', round(p_fee, 2), 'shipping_status', v_status);
end $$;

-- Shopper: send the GCash receipt for the shipping fee.
create or replace function public.submit_shipping_payment(p_order uuid, p_sender text, p_reference text, p_receipt_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ref text := regexp_replace(coalesce(p_reference, ''), '\s', '', 'g');
  o     public.orders;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into o from public.orders where id = p_order and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'paid' then raise exception 'ORDER_NOT_PAID'; end if;
  if o.shipping_status <> 'awaiting_payment' then raise exception 'SHIPPING_NOT_DUE'; end if;
  if char_length(btrim(coalesce(p_sender, ''))) not between 1 and 120 then raise exception 'INVALID_SENDER'; end if;
  if char_length(v_ref) not between 1 and 64 then raise exception 'INVALID_REFERENCE'; end if;
  if not public.valid_receipt_path(p_receipt_path, v_uid) then raise exception 'INVALID_RECEIPT'; end if;
  if exists (select 1 from public.orders where status <> 'cancelled'
             and (public.normalize_reference(reference_number) = public.normalize_reference(v_ref)
               or public.normalize_reference(shipping_reference_number) = public.normalize_reference(v_ref))) then raise exception 'DUPLICATE_REFERENCE'; end if;
  update public.orders set shipping_sender_name = btrim(p_sender), shipping_reference_number = v_ref, shipping_receipt_path = p_receipt_path,
         shipping_status = 'pending_review', shipping_note = null, updated_at = now() where id = p_order;
  return jsonb_build_object('shipping_status', 'pending_review');
end $$;

-- Admin: accept the shipping receipt, or send it back with a reason so the shopper can pay again.
create or replace function public.review_shipping_payment(p_order uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.shipping_status <> 'pending_review' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    update public.orders set shipping_status = 'paid', shipping_note = null, updated_at = now() where id = p_order;
    return jsonb_build_object('shipping_status', 'paid');
  end if;
  if v_note is null or char_length(v_note) > 300 then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set shipping_status = 'awaiting_payment', shipping_note = v_note, shipping_reference_number = null,
         shipping_sender_name = null, shipping_receipt_path = null, updated_at = now() where id = p_order;
  return jsonb_build_object('shipping_status', 'awaiting_payment');
end $$;

revoke all on function public.set_order_shipping(uuid, numeric) from public, anon;
revoke all on function public.submit_shipping_payment(uuid, text, text, text) from public, anon;
revoke all on function public.review_shipping_payment(uuid, boolean, text) from public, anon;
grant execute on function public.set_order_shipping(uuid, numeric) to authenticated;
grant execute on function public.submit_shipping_payment(uuid, text, text, text) to authenticated;
grant execute on function public.review_shipping_payment(uuid, boolean, text) to authenticated;
