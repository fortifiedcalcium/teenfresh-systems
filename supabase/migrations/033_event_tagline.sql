-- 033: a short headline for the home page. An event can have a `tagline` (for example "Fan meet, kits and a night to remember"); the home page
-- shows it as the big heading, falling back to the subtitle and then the title when it is empty. Only adds a nullable column.
-- Run this in the Supabase SQL Editor after 032.
alter table public.events add column if not exists tagline text;
alter table public.events drop constraint if exists events_tagline_length;
alter table public.events add constraint events_tagline_length check (tagline is null or char_length(tagline) <= 120);
