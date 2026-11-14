-- 023: An editable list of couriers. Run AFTER 022_courier_locked_after_fee.sql.
-- Shoppers pick their courier from this list, and admins ship with one from it. "Other" (typing any name) always exists and is not stored here.
-- Orders keep the courier name as plain text, so deleting a courier never changes an order that already uses it.

create table if not exists public.couriers (
  id   bigint generated always as identity primary key,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60 and lower(name) <> 'other')
);
create unique index if not exists couriers_name_key on public.couriers (lower(name));

insert into public.couriers (name)
select n from unnest(array['J&T Express', 'LBC', 'JRS Express', 'Ninja Van', 'Flash Express', '2GO', 'Lalamove', 'Grab Express', 'Pick-up by the shopper']) as t(n)
where not exists (select 1 from public.couriers);

alter table public.couriers enable row level security;
drop policy if exists couriers_public_read on public.couriers;
drop policy if exists couriers_admin_all on public.couriers;
create policy couriers_public_read on public.couriers for select to anon, authenticated using (true);
create policy couriers_admin_all   on public.couriers for all to authenticated using (public.is_admin()) with check (public.is_admin());
