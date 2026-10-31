import { supabase } from "./supabaseClient.js";

export const BUCKET = "event-media";
export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The five image slots. `ratio` reserves the space so nothing jumps when an image loads. */
export const SLOTS = {
  poster:       { label: "Event poster",          ratio: "3 / 4",  w: 1200, h: 1600, recommended: "3:4 portrait, 1200 x 1600 px",                  placeholder: "Event poster image coming soon",       where: "Top of the registration form and the event page" },
  details_card: { label: "Event details card",    ratio: "3 / 4",  w: 1200, h: 1600, recommended: "3:4 portrait, 1200 x 1600 px",                  placeholder: "Event details image coming soon",      where: "\"Event details\" section of the registration form" },
  gcash_qr:     { label: "GCash QR code",         ratio: "8 / 15", w: 1080, h: 2025, recommended: "tall, about 8:15, for example 1080 x 2025 px", placeholder: "GCash QR code image coming soon",      where: "Payment step of the registration form" },
  banner:       { label: "Home page banner",      ratio: "16 / 9", w: 1600, h: 900,  recommended: "16:9, 1600 x 900 px",                           placeholder: "Event banner image coming soon",       where: "Event card on the home page" },
  email_banner: { label: "Confirmation email banner", ratio: "4 / 1", w: 1600, h: 400, recommended: "4:1, 1600 x 400 px (falls back to the home page banner)", placeholder: "Email banner image coming soon", where: "Top of the confirmation email" },
};
export const SLOT_KEYS = Object.keys(SLOTS);

/** Public URL of an image row (an object in the event-media bucket, or an external URL). */
export function imageUrl(row) {
  if (!row) return null;
  if (row.storage_path) {
    try { return supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl; } catch { return null; }
  }
  return row.external_url || null;
}

export async function fetchEventImages(eventId) {
  const { data } = await supabase.from("event_images").select("*").eq("event_id", eventId);
  return Object.fromEntries((data || []).map((r) => [r.slot, r]));
}

export function validateImageFile(file) {
  if (!file) return "Choose an image.";
  if (!IMAGE_TYPES[file.type]) return "Use a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "The image is larger than 5 MB.";
  return null;
}

/** Uploads a new image (or replaces the current one) for a slot. No redeploy needed: the page reads the table. */
export async function uploadEventImage(event, slot, file, altText, previous) {
  const bad = validateImageFile(file);
  if (bad) throw new Error(bad);
  const path = `${event.id}/${slot}-${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (up.error) throw new Error("Upload failed: " + up.error.message);
  const alt = (altText ?? previous?.alt_text ?? "").trim() || null;
  const { error } = await supabase.from("event_images").upsert({ event_id: event.id, slot, storage_path: path, external_url: null, alt_text: alt, updated_at: new Date().toISOString() }, { onConflict: "event_id,slot" });
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(error.message); }
  if (previous?.storage_path) await supabase.storage.from(BUCKET).remove([previous.storage_path]);   // tidy up the replaced file
}

export async function saveImageAlt(row, altText) {
  const { error } = await supabase.from("event_images").update({ alt_text: altText.trim() || null, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw new Error(error.message);
}

export async function removeEventImage(row) {
  const { error } = await supabase.from("event_images").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
  if (row.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
}
