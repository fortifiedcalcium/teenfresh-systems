-- 030: Layers of variations, like buying a phone: Color, then Storage. Run AFTER 029_product_variations.sql.
-- A product lists its layers (up to 3), each with its values: [{"name":"Color","values":["Black","White"]},{"name":"Storage","values":["128GB","256GB"]}].
-- Every combination is a row in product_variations (the thing that is bought and priced, as before), named like "Black / 128GB", with the choice
-- kept in `options`: {"Color":"Black","Storage":"128GB"}. A combination that is not for sale is simply hidden (active = false).
-- Orders and place_order() are unchanged: they already work from a variation row.

alter table public.products
  add column if not exists variation_layers jsonb not null default '[]'::jsonb check (jsonb_typeof(variation_layers) = 'array' and jsonb_array_length(variation_layers) <= 3);
alter table public.product_variations
  add column if not exists options jsonb check (options is null or jsonb_typeof(options) = 'object');
