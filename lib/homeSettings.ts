import { supabase } from "./supabaseClient";
import { BUCKET, IMAGE_TYPES, validateImageFile } from "./eventImages";

export interface HomeSettings { banner_path: string | null; banner_alt: string | null; banner_decorative: boolean; featured_event_id: string | null }
export const BANNER_ALT_MAX = 200;
export const NO_HOME_SETTINGS: HomeSettings = { banner_path: null, banner_alt: null, banner_decorative: false, featured_event_id: null };

/** Public URL of the banner picture, or null when there is none. */
export function bannerUrl(s: Pick<HomeSettings, "banner_path"> | null | undefined): string | null {
  if (!s?.banner_path) return null;
  try { return supabase.storage.from(BUCKET).getPublicUrl(s.banner_path).data.publicUrl; } catch { return null; }
}

/** What to say about the banner picture to a screen reader: nothing for a decorative one. */
export const bannerAlt = (s: Pick<HomeSettings, "banner_alt" | "banner_decorative">) => (s.banner_decorative ? "" : (s.banner_alt || "").trim());

/** The first problem with the banner form, or "" when it can be saved. */
export function validateBanner(s: { hasImage: boolean; decorative: boolean; alt: string }): string {
  if (s.hasImage && !s.decorative && !s.alt.trim()) return "Describe the picture in a few words, or tick \"Decorative\" if it says nothing.";
  if (s.alt.length > BANNER_ALT_MAX) return `The description is longer than ${BANNER_ALT_MAX} characters.`;
  return "";
}

/** The event shown in the hero: the one an admin chose, otherwise the next one people can still register for, otherwise the first. */
export function pickFeatured<T extends { id: string }>(events: T[], chosenId: string | null | undefined, canRegister: (_e: T) => boolean): T | null {
  return events.find((e) => e.id === chosenId) || events.find(canRegister) || events[0] || null;
}

export async function uploadBanner(file: File): Promise<string> {
  const bad = validateImageFile(file);
  if (bad) throw new Error(bad);
  const path = `home/banner-${crypto.randomUUID()}.${IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES]}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (up.error) throw new Error("Upload failed: " + up.error.message);
  return path;
}
export const removeBanner = (path: string | null) => (path ? supabase.storage.from(BUCKET).remove([path]) : Promise.resolve());
