-- 017: Images inside a product's Description section. Run AFTER 016_shop_pesos.sql.
-- Paths of files in the public 'event-media' bucket (under products/), shown in the order listed.

alter table public.products
  add column if not exists info_images text[] not null default '{}' check (cardinality(info_images) <= 10);
