import { supabase } from "./supabaseClient";
import { BUCKET, IMAGE_TYPES, validateImageFile } from "./eventImages";
import { shrinkOrRefuse } from "./imageShrink";
import { validatePreorderDates } from "./preorder";
import { COMBOS_MAX, finalVariations, normalizeLayers, validateLayers, validateStock } from "./variations";

/** The shop's filter chips: "All" and "Pre-Order" are built in; the rest are the categories an admin manages (table product_categories). */
export const chipsFor = (categories) => ["All", ...(categories || []), "Pre-Order"];
export const CATEGORY_MAX = 40;
/** A problem with a new category name, or "" when it is fine. `existing` are the names already in use. */
export function validateCategoryName(name, existing = []) {
  const n = String(name).trim();
  if (!n) return "Type a category name.";
  if (n.length > CATEGORY_MAX) return `A category name can be ${CATEGORY_MAX} characters at most.`;
  if (["all", "pre-order"].includes(n.toLowerCase())) return `"${n}" is a built-in filter, so it cannot be a category.`;
  if (existing.some((e) => e.trim().toLowerCase() === n.toLowerCase())) return "That category already exists.";
  return "";
}

/** The accordion sections on the product page: [column, heading]. A section with no text is not shown. */
export const INFO_SECTIONS = [
  ["info_description", "Product Description"],
  ["info_specs", "Specifications"],
  ["info_shipping", "Production, Shipping & Exchange"],
  ["info_notes", "Other Information"],
];
export const INFO_MAX = 4000;
/** The sections with no length limit (the database has none for them either: migration 038). */
export const INFO_UNLIMITED = ["info_shipping"];
export const infoMax = (key: string): number | undefined => (INFO_UNLIMITED.includes(key) ? undefined : INFO_MAX);
export const INFO_IMAGES_MAX = 10;

export const productMatches = (p, chip) => chip === "All" || (chip === "Pre-Order" ? p.pre_order : (p.categories || []).includes(chip));

export function productImageUrl(p) {
  if (!p?.image_path) return null;
  try { return supabase.storage.from(BUCKET).getPublicUrl(p.image_path).data.publicUrl; } catch { return null; }
}

export const VARIATIONS_MAX = 20;
/** A problem with a product's versions (variations), in plain words, or "" when they are fine. Each is { name, price } with an optional price. */
export function validateVariations(list, max = VARIATIONS_MAX, { requirePrice = false } = {}) {
  const seen = new Set();
  if (list.length > max) return `A product can have up to ${max} variations.`;
  for (const v of list) {
    const name = String(v.name ?? "").trim();
    if (!name) return "Every variation needs a name, or remove the empty one.";
    if (name.length > 60) return `The name "${name.slice(0, 20)}…" is too long: 60 characters at most.`;
    if (seen.has(name.toLowerCase())) return `"${name}" is used twice. Give each variation its own name.`;
    seen.add(name.toLowerCase());
    const price = String(v.price ?? "").trim();
    if (requirePrice && price === "") return `Enter a price for "${name}".`;
    if (price !== "" && (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0)) return `The price of "${name}" must be above 0, with at most 2 decimals${requirePrice ? "." : ", or empty to use the product's price."}`;
    const stock = validateStock(v.stock, name);
    if (stock) return stock;
  }
  return "";
}

/** One problem per field, in plain words. The database checks the same limits. */
export function validateProduct(f) {
  const e: Record<string, any> = {};
  if (!f.artist.trim()) e.artist = "Enter the artist's name";
  else if (f.artist.trim().length > 80) e.artist = "The artist can be 80 characters at most";
  if (!f.title.trim()) e.title = "Enter the product title";
  else if (f.title.trim().length > 160) e.title = "The title can be 160 characters at most";
  const hasVariations = normalizeLayers(f.layers).length > 0 || (f.variations || []).length > 0;
  // a product with variations is priced by them (the shop shows the range), so it has no price of its own to enter
  if (!hasVariations && (!/^\d+(\.\d{1,2})?$/.test(String(f.price).trim()) || Number(f.price) <= 0)) e.price = "Enter a price in pesos above 0, with at most 2 decimals";
  const d = String(f.discount_percent).trim();
  if (d !== "" && (!/^\d+$/.test(d) || Number(d) > 90)) e.discount_percent = "Enter a whole number from 0 to 90";
  const layers = normalizeLayers(f.layers);
  const vmsg = layers.length ? validateLayers(layers) || validateVariations(finalVariations(f), COMBOS_MAX, { requirePrice: true }) : validateVariations(f.variations || [], VARIATIONS_MAX, { requirePrice: true });       // layers make the combinations; without them it is the simple list
  if (vmsg) e.variations = vmsg;
  if (finalVariations(f).length === 0) { const s = validateStock(f.stock, "this product"); if (s) e.stock = s; }
  if (f.pre_order) { const m = validatePreorderDates(String(f.pre_order_starts_on || ""), String(f.pre_order_ends_on || "")); if (m) e.pre_order_dates = m; }
  for (const [k, label] of INFO_SECTIONS) if (infoMax(k) && (f[k] || "").length > INFO_MAX) e[k] = `${label} can be ${INFO_MAX} characters at most`;
  return e;
}

/** The price saved on the product itself: its own price, or, when it has variations, the lowest of theirs (the shop shows the range). */
export function basePrice(f) {
  const prices = finalVariations(f).map((v) => Number(String(v.price).trim())).filter((n) => n > 0);
  return prices.length > 0 ? Math.min(...prices) : Number(f.price);
}

export function productRow(f) {
  return {
    artist: f.artist.trim(), title: f.title.trim(), price: basePrice(f), discount_percent: String(f.discount_percent).trim() === "" ? 0 : Number(f.discount_percent),
    ...Object.fromEntries(INFO_SECTIONS.map(([k]) => [k, (f[k] || "").trim() || null])),
    variation_layers: normalizeLayers(f.layers),
    ...(String(f.slug || "").trim() ? { slug: String(f.slug).trim() } : {}),   // blank keeps the current address (or derives one from the title)
    // a product with versions counts stock on each version; one without keeps its own count (empty = not counted)
    stock: finalVariations(f).length > 0 || String(f.stock ?? "").trim() === "" ? null : Number(f.stock),
    pre_order: f.pre_order, pre_order_starts_on: f.pre_order && f.pre_order_starts_on ? f.pre_order_starts_on : null, pre_order_ends_on: f.pre_order && f.pre_order_ends_on ? f.pre_order_ends_on : null, is_new: f.is_new, categories: f.categories, image_alt: f.image_alt.trim() || null, active: f.active, updated_at: new Date().toISOString(),
  };
}

/** Uploads a product image and returns its storage path. */
export async function uploadProductImage(original, { lossless = false } = {}) {
  const bad = validateImageFile(original);
  if (bad) throw new Error(bad);
  const file = lossless ? await shrinkOrRefuse(original, 4096, { lossless: true }) : await shrinkOrRefuse(original, 1600);   // a QR code is saved lossless, so every pixel stays
  const path = `products/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (up.error) throw new Error("Upload failed: " + up.error.message);
  return path;
}
export const removeProductImage = (path) => (path ? supabase.storage.from(BUCKET).remove([path]) : Promise.resolve());
