-- 034: the home page banner. One row holds the banner background image (a file in the public 'event-media' bucket), its alt text (or a
-- "decorative" flag when the picture says nothing), and which event is featured in the hero (the priority event). Everyone can read it; only
-- admins can change it. Run this in the Supabase SQL Editor after 033. It only adds a table.

create table if not exists public.home_settings (
  id                 boolean primary key default true check (id),                      -- one row only
  banner_path        text check (banner_path is null or char_length(banner_path) <= 300),
  banner_alt         text check (banner_alt is null or char_length(banner_alt) <= 200),
  banner_decorative  boolean not null default false,
  featured_event_id  uuid references public.events(id) on delete set null,
  updated_at         timestamptz not null default now(),
  -- a picture that is not decorative needs alt text
  constraint home_banner_alt_required check (banner_path is null or banner_decorative or char_length(btrim(coalesce(banner_alt, ''))) > 0)
);
insert into public.home_settings (id) values (true) on conflict do nothing;

alter table public.home_settings enable row level security;
drop policy if exists home_settings_read  on public.home_settings;
drop policy if exists home_settings_admin on public.home_settings;
create policy home_settings_read  on public.home_settings for select to anon, authenticated using (true);
create policy home_settings_admin on public.home_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
