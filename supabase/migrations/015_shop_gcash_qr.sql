-- 015: GCash QR code image for shop checkout. Run AFTER 014_product_info.sql.
-- The image lives in the public 'event-media' bucket (under products/), like product images.

alter table public.shop_settings add column if not exists gcash_qr_path text;
