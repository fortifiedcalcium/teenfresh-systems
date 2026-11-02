-- 006: one form = one kit. Run AFTER 005_underpayment_top_up.sql.
-- The registration form no longer asks for a quantity. Every kit now allows exactly one per form, so the
-- database refuses any quantity above 1 (submit_registration raises INVALID_QUANTITY, as before).
-- Orders already placed keep their quantity and price untouched.

alter table public.event_kits alter column max_per_order set default 1;
update public.event_kits set max_per_order = 1 where max_per_order <> 1;
