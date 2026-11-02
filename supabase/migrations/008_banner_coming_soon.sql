-- 008: "Coming soon" banner. Run AFTER 007_free_reference_number.sql.
-- An admin can switch an event's home-page banner to a "Coming soon" panel instead of uploading an image.
-- The flag is only about what the banner shows; the uploaded image (if any) is kept and returns when the switch is turned off.

alter table public.events add column if not exists banner_coming_soon boolean not null default false;
