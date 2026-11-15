-- 032: readable addresses. Events and products get a unique `slug` (for example "ivemon-odd-platinum-cupsleeve-event"), so the site can use
-- /events/<slug> and /shop/<slug> instead of the id. Existing rows are filled in from their titles; new rows get one automatically
-- (and an admin can change it later). The old id addresses keep working, because the site accepts either.
-- Run this in the Supabase SQL Editor after 031. It only adds a column and a trigger: nothing else about events or products changes.

create or replace function public.slugify(t text) returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(btrim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'item')
$$;

-- a free slug for `base` in `tbl`, adding -2, -3 ... when it is taken (`self` is the row being renamed, so it does not clash with itself)
create or replace function public.free_slug(tbl text, base text, self uuid) returns text language plpgsql set search_path = public as $$
declare cand text := base; n int := 1; taken boolean;
begin
  loop
    execute format('select exists (select 1 from public.%I where slug = $1 and id is distinct from $2)', tbl) into taken using cand, self;
    exit when not taken;
    n := n + 1; cand := base || '-' || n;
  end loop;
  return cand;
end $$;

alter table public.events   add column if not exists slug text;
alter table public.products add column if not exists slug text;

-- fill the rows that exist now, oldest first, so the oldest keeps the plain slug
do $$
declare r record;
begin
  for r in select id, title from public.events   where slug is null order by created_at, id loop update public.events   set slug = public.free_slug('events',   public.slugify(r.title), r.id) where id = r.id; end loop;
  for r in select id, title from public.products where slug is null order by created_at, id loop update public.products set slug = public.free_slug('products', public.slugify(r.title), r.id) where id = r.id; end loop;
end $$;

alter table public.events   alter column slug set not null;
alter table public.products alter column slug set not null;
create unique index if not exists events_slug_key   on public.events   (slug);
create unique index if not exists products_slug_key on public.products (slug);
alter table public.events   add constraint events_slug_format   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120);
alter table public.products add constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120);

-- a new row without a slug gets one from its title; a slug that is given is cleaned up and made unique
create or replace function public.set_slug() returns trigger language plpgsql set search_path = public as $$
begin
  new.slug := public.free_slug(tg_table_name, public.slugify(coalesce(nullif(btrim(new.slug), ''), new.title)), new.id);
  return new;
end $$;
drop trigger if exists events_set_slug on public.events;
drop trigger if exists products_set_slug on public.products;
create trigger events_set_slug   before insert or update of slug on public.events   for each row execute function public.set_slug();
create trigger products_set_slug before insert or update of slug on public.products for each row execute function public.set_slug();
