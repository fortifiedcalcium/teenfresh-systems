-- 037: editable hero text. The home page hero shows a headline and a description under it. An admin can now write both on the Home page screen;
-- an empty headline falls back to the featured event's headline, subtitle or title, and an empty description to the standard sentence.
-- Run this in the Supabase SQL Editor after 036. It only adds two nullable columns to home_settings (same RLS: everyone reads, admins write).
alter table public.home_settings add column if not exists hero_headline    text;
alter table public.home_settings add column if not exists hero_description text;
alter table public.home_settings drop constraint if exists home_hero_headline_length;
alter table public.home_settings drop constraint if exists home_hero_description_length;
alter table public.home_settings add constraint home_hero_headline_length    check (hero_headline is null or char_length(hero_headline) <= 120);
alter table public.home_settings add constraint home_hero_description_length check (hero_description is null or char_length(hero_description) <= 300);
