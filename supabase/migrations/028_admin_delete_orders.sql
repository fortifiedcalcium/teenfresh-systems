-- 028: Admins can delete a shop order. Run AFTER 027_payment_references.sql.
-- Deleting an order also removes its items and its email log (they follow the order). The admin page deletes the receipt files too.
-- The Change log records who deleted which order (without any personal details).

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete on public.orders for delete to authenticated using (public.is_admin());
