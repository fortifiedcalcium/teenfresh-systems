-- 021: Editable product categories. Run AFTER 020_preferred_courier.sql.
-- The list of categories an admin can tick on a product (and that become the shop's filter chips) now lives in this table.
-- Products still keep the category NAMES in products.categories. Deleting a category also removes it from every product.
-- "All" and "Pre-Order" are built-in filters and cannot be used as category names.

create table if not exists public.product_categories (
  id   bigint generated always as identity primary key,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40 and lower(name) not in ('all', 'pre-order'))
);
create unique index if not exists product_categories_name_key on public.product_categories (lower(name));

-- the categories the shop already used, in their usual order (does nothing if they exist)
insert into public.product_categories (name)
select n from unnest(array['BEST', 'ALBUM', 'Drama/Movie', 'DVD', 'PHOTOBOOK', 'MD', '2027 Season''s Greetings']) as t(n)
where not exists (select 1 from public.product_categories);

alter table public.product_categories enable row level security;
drop policy if exists product_categories_public_read on public.product_categories;
drop policy if exists product_categories_admin_all on public.product_categories;
create policy product_categories_public_read on public.product_categories for select to anon, authenticated using (true);
create policy product_categories_admin_all   on public.product_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admin: delete a category and take it off every product that has it.
create or replace function public.delete_product_category(p_name text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.products set categories = array_remove(categories, p_name), updated_at = now() where p_name = any (categories);
  get diagnostics v_n = row_count;
  delete from public.product_categories where name = p_name;
  return v_n;
end $$;
revoke all on function public.delete_product_category(text) from public, anon;
grant execute on function public.delete_product_category(text) to authenticated;
