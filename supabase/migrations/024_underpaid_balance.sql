-- 024: Underpaid orders: the admin asks for the remaining amount, the shopper pays it, the admin checks it. Run AFTER 023_couriers.sql.
-- It works the same for the items payment (order still pending) and for the shipping fee (receipt being checked):
--   admin  request_balance()         "you are short, send the remaining amount" (and why)      -> balance_status = awaiting_payment
--   shopper submit_balance_payment() sender, reference number and receipt for that amount       -> balance_status = pending_review
--   admin  review_balance_payment()  confirm it (balance_status = none) or send it back with a reason
-- The order cannot be marked paid (items) or have its shipping payment confirmed while a balance is open. One reference number can
-- be used only once across all three payments of an order and across all orders.

alter table public.orders
  add column if not exists balance_status           text not null default 'none' check (balance_status in ('none', 'awaiting_payment', 'pending_review')),
  add column if not exists balance_for              text check (balance_for in ('items', 'shipping')),
  add column if not exists balance_due_php          numeric(10,2) check (balance_due_php is null or balance_due_php > 0),
  add column if not exists balance_note             text,
  add column if not exists balance_sender_name      text,
  add column if not exists balance_reference_number text,
  add column if not exists balance_receipt_path     text,
  add column if not exists balance_paid_php         numeric(10,2) not null default 0;     -- the extra amounts already confirmed

alter table public.orders drop constraint if exists orders_balance_blocks_paid;
alter table public.orders add constraint orders_balance_blocks_paid check (balance_status = 'none' or status <> 'shipped' and not (balance_for = 'items' and status = 'paid'));
create unique index if not exists orders_balance_reference_key on public.orders (public.normalize_reference(balance_reference_number))
  where balance_reference_number is not null and status <> 'cancelled';

-- a new email: "your payment is short"
alter table public.order_emails drop constraint if exists order_emails_kind_check;
alter table public.order_emails add constraint order_emails_kind_check check (kind in ('order_received', 'order_paid', 'order_balance_due', 'order_shipping_due', 'order_shipped', 'order_cancelled'));
alter table public.order_email_templates drop constraint if exists order_email_templates_kind_check;
alter table public.order_email_templates add constraint order_email_templates_kind_check check (kind in ('order_received', 'order_paid', 'order_balance_due', 'order_shipping_due', 'order_shipped', 'order_cancelled'));

-- Is this reference number already used by any live order, for any of its three payments? (Runs with the owner's rights: shoppers cannot read other orders.)
create or replace function public.reference_in_use(p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where status <> 'cancelled'
    and public.normalize_reference(p_ref) in (public.normalize_reference(reference_number), public.normalize_reference(shipping_reference_number), public.normalize_reference(balance_reference_number)));
$$;
revoke all on function public.reference_in_use(text) from public, anon, authenticated;

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
  if public.reference_in_use(v_ref) then raise exception 'DUPLICATE_REFERENCE'; end if;

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
  if public.reference_in_use(v_ref) then raise exception 'DUPLICATE_REFERENCE'; end if;
  update public.orders set shipping_sender_name = btrim(p_sender), shipping_reference_number = v_ref, shipping_receipt_path = p_receipt_path,
         shipping_status = 'pending_review', shipping_note = null, updated_at = now() where id = p_order;
  return jsonb_build_object('shipping_status', 'pending_review');
end $$;

create or replace function public.review_shipping_payment(p_order uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.shipping_status <> 'pending_review' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    if o.balance_status <> 'none' then raise exception 'BALANCE_OPEN'; end if;
    update public.orders set shipping_status = 'paid', shipping_note = null, updated_at = now() where id = p_order;
    return jsonb_build_object('shipping_status', 'paid');
  end if;
  if v_note is null or char_length(v_note) > 300 then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set shipping_status = 'awaiting_payment', shipping_note = v_note, shipping_reference_number = null,
         shipping_sender_name = null, shipping_receipt_path = null, updated_at = now() where id = p_order;
  return jsonb_build_object('shipping_status', 'awaiting_payment');
end $$;

-- Admin: ask for the remaining amount (p_amount > 0), change it, or cancel the request (p_amount = 0). Items: while the order is pending. Shipping: while its receipt is being checked.
create or replace function public.request_balance(p_order uuid, p_for text, p_amount numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_max numeric;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_for not in ('items', 'shipping') then raise exception 'INVALID_BALANCE'; end if;
  if o.balance_status = 'pending_review' then raise exception 'BALANCE_LOCKED'; end if;            -- the shopper already sent the money: review it first
  if p_for = 'items' and o.status <> 'pending' then raise exception 'ORDER_NOT_PENDING'; end if;
  if p_for = 'shipping' and not (o.status = 'paid' and o.shipping_status = 'pending_review') then raise exception 'SHIPPING_NOT_PENDING'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'INVALID_BALANCE'; end if;
  if p_amount = 0 then
    update public.orders set balance_status = 'none', balance_for = null, balance_due_php = null, balance_note = null, updated_at = now() where id = p_order;
    return jsonb_build_object('balance_status', 'none');
  end if;
  v_max := case when p_for = 'items' then o.total_php else o.shipping_fee_php end;
  if p_amount > v_max then raise exception 'INVALID_BALANCE'; end if;                                -- never more than what the order asks for
  if char_length(coalesce(v_note, '')) > 300 then raise exception 'INVALID_BALANCE'; end if;
  update public.orders set balance_status = 'awaiting_payment', balance_for = p_for, balance_due_php = round(p_amount, 2), balance_note = v_note, updated_at = now() where id = p_order;
  return jsonb_build_object('balance_status', 'awaiting_payment', 'balance_due_php', round(p_amount, 2));
end $$;

-- Shopper: send the GCash receipt for the remaining amount.
create or replace function public.submit_balance_payment(p_order uuid, p_sender text, p_reference text, p_receipt_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ref text := regexp_replace(coalesce(p_reference, ''), '\s', '', 'g');
  o     public.orders;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into o from public.orders where id = p_order and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('pending', 'paid') then raise exception 'ORDER_LOCKED'; end if;
  if o.balance_status <> 'awaiting_payment' then raise exception 'BALANCE_NOT_DUE'; end if;
  if char_length(btrim(coalesce(p_sender, ''))) not between 1 and 120 then raise exception 'INVALID_SENDER'; end if;
  if char_length(v_ref) not between 1 and 64 then raise exception 'INVALID_REFERENCE'; end if;
  if not public.valid_receipt_path(p_receipt_path, v_uid) then raise exception 'INVALID_RECEIPT'; end if;
  if public.reference_in_use(v_ref) then raise exception 'DUPLICATE_REFERENCE'; end if;
  update public.orders set balance_sender_name = btrim(p_sender), balance_reference_number = v_ref, balance_receipt_path = p_receipt_path,
         balance_status = 'pending_review', updated_at = now() where id = p_order;
  return jsonb_build_object('balance_status', 'pending_review');
end $$;

-- Admin: accept the extra payment, or send it back with a reason so the shopper can pay again.
create or replace function public.review_balance_payment(p_order uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.balance_status <> 'pending_review' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    update public.orders set balance_paid_php = balance_paid_php + balance_due_php, balance_status = 'none', balance_due_php = null, balance_note = null, updated_at = now() where id = p_order;
    return jsonb_build_object('balance_status', 'none');
  end if;
  if v_note is null or char_length(v_note) > 300 then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set balance_status = 'awaiting_payment', balance_note = v_note, balance_sender_name = null, balance_reference_number = null, balance_receipt_path = null, updated_at = now() where id = p_order;
  return jsonb_build_object('balance_status', 'awaiting_payment');
end $$;

revoke all on function public.request_balance(uuid, text, numeric, text) from public, anon;
revoke all on function public.submit_balance_payment(uuid, text, text, text) from public, anon;
revoke all on function public.review_balance_payment(uuid, boolean, text) from public, anon;
grant execute on function public.request_balance(uuid, text, numeric, text) to authenticated;
grant execute on function public.submit_balance_payment(uuid, text, text, text) to authenticated;
grant execute on function public.review_balance_payment(uuid, boolean, text) to authenticated;
