-- 014: Product info sections shown as accordions on the product page. Run AFTER 013_order_email_templates.sql.
-- Plain text, line breaks kept. A section left empty is not shown to visitors.

alter table public.products
  add column if not exists info_description text check (info_description is null or char_length(info_description) <= 4000),
  add column if not exists info_specs       text check (info_specs is null or char_length(info_specs) <= 4000),
  add column if not exists info_shipping    text check (info_shipping is null or char_length(info_shipping) <= 4000),
  add column if not exists info_notes       text check (info_notes is null or char_length(info_notes) <= 4000);
