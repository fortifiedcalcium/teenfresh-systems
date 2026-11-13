-- 010: Shop products. Run AFTER 009_upload_limit_10mb.sql.
-- Everyone can read the products that are switched on; only admins can add, change or remove them.
-- Product images go in the existing public 'event-media' bucket, under products/ (admin write, public read already apply).

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  artist           text not null check (char_length(btrim(artist)) between 1 and 80),
  title            text not null check (char_length(btrim(title)) between 1 and 160),
  price            numeric(10,2) not null check (price > 0),                 -- USD, the price shown (already discounted)
  discount_percent integer not null default 0 check (discount_percent between 0 and 90),
  pre_order        boolean not null default false,
  is_new           boolean not null default false,
  categories       text[] not null default '{}',
  image_path       text,                                                    -- object in the 'event-media' bucket
  image_alt        text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists products_active_idx on public.products (active, created_at desc);

alter table public.products enable row level security;
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_all on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (active);
create policy products_admin_all   on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
