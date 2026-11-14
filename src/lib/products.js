import { supabase } from "./supabaseClient.js";
import { BUCKET, IMAGE_TYPES, validateImageFile } from "./eventImages.js";

/** The shop's filter chips. "All" and "Pre-Order" are computed; the rest are categories an admin ticks on a product. */
export const CATEGORIES = ["BEST", "ALBUM", "Drama/Movie", "DVD", "PHOTOBOOK", "MD", "2027 Season's Greetings"];
export const CHIPS = ["All", "BEST", "ALBUM", "Drama/Movie", "DVD", "PHOTOBOOK", "MD", "Pre-Order", "2027 Season's Greetings"];

/** The accordion sections on the product page: [column, heading]. A section with no text is not shown. */
export const INFO_SECTIONS = [
  ["info_description", "Description"],
  ["info_specs", "Specifications"],
  ["info_shipping", "Shipping & exchange"],
  ["info_notes", "Other notes"],
];
export const INFO_MAX = 4000;

export const usd =(n) => `$${Number(n).toFixed(2)}`;
export const productMatches = (p, chip) => chip === "All" || (chip === "Pre-Order" ? p.pre_order : (p.categories || []).includes(chip));

export function productImageUrl(p) {
  if (!p?.image_path) return null;
  try { return supabase.storage.from(BUCKET).getPublicUrl(p.image_path).data.publicUrl; } catch { return null; }
}

/** One problem per field, in plain words. The database checks the same limits. */
export function validateProduct(f) {
  const e = {};
  if (!f.artist.trim()) e.artist = "Enter the artist's name";
  else if (f.artist.trim().length > 80) e.artist = "The artist can be 80 characters at most";
  if (!f.title.trim()) e.title = "Enter the product title";
  else if (f.title.trim().length > 160) e.title = "The title can be 160 characters at most";
  if (!/^\d+(\.\d{1,2})?$/.test(String(f.price).trim()) || Number(f.price) <= 0) e.price = "Enter a price above 0, with at most 2 decimals";
  const d = String(f.discount_percent).trim();
  if (d !== "" && (!/^\d+$/.test(d) || Number(d) > 90)) e.discount_percent = "Enter a whole number from 0 to 90";
  for (const [k, label] of INFO_SECTIONS) if ((f[k] || "").length > INFO_MAX) e[k] = `${label} can be ${INFO_MAX} characters at most`;
  return e;
}

export function productRow(f) {
  return {
    artist: f.artist.trim(), title: f.title.trim(), price: Number(f.price), discount_percent: String(f.discount_percent).trim() === "" ? 0 : Number(f.discount_percent),
    ...Object.fromEntries(INFO_SECTIONS.map(([k]) => [k, (f[k] || "").trim() || null])),
    pre_order: f.pre_order, is_new: f.is_new, categories: f.categories, image_alt: f.image_alt.trim() || null, active: f.active, updated_at: new Date().toISOString(),
  };
}

/** Uploads a product image and returns its storage path. */
export async function uploadProductImage(file) {
  const bad = validateImageFile(file);
  if (bad) throw new Error(bad);
  const path = `products/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (up.error) throw new Error("Upload failed: " + up.error.message);
  return path;
}
export const removeProductImage = (path) => (path ? supabase.storage.from(BUCKET).remove([path]) : Promise.resolve());
