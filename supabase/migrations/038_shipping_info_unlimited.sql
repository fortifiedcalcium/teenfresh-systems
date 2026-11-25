-- 038: The product's "Production, Shipping & Exchange" text has no length limit any more. Run AFTER 037_home_hero_text.sql.
-- (The other product info sections keep their 4000 character limit.) Safe to run more than once.

alter table public.products drop constraint if exists products_info_shipping_check;
