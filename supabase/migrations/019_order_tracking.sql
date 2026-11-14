-- 019: Courier and tracking number for shipped orders. Run AFTER 018_order_shipping_payment.sql.
-- The admin enters them when marking an order shipped; the shopper sees them on the order page and in the shipped email.

alter table public.orders
  add column if not exists courier         text check (courier is null or char_length(btrim(courier)) between 1 and 60),
  add column if not exists tracking_number text check (tracking_number is null or char_length(btrim(tracking_number)) between 1 and 60);
