import { supabase } from "./supabaseClient";
import { BUCKET, IMAGE_TYPES, validateImageFile } from "./eventImages";

export interface HomeSettings { banner_path: string | null; banner_alt: string | null; banner_decorative: boolean; featured_event_id: string | null; hero_headline?: string | null; hero_description?: string | null }
export const BANNER_ALT_MAX = 200;
export const HERO_HEADLINE_MAX = 120;
export const HERO_DESCRIPTION_MAX = 300;
export const DEFAULT_HERO_DESCRIPTION = "Pick an event and reserve your slot. Pay by GCash and your ticket arrives by email once the payment is checked.";
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

/** The hero headline: what an admin typed, else the featured event's headline, subtitle or title. */
export const heroHeadline = (s: Pick<HomeSettings, "hero_headline"> | null | undefined, e: { tagline?: string | null; subtitle?: string | null; title?: string | null } | null | undefined): string =>
  (s?.hero_headline || "").trim() || e?.tagline || e?.subtitle || e?.title || "Upcoming events";
/** The hero description: what an admin typed, else the standard sentence. */
export const heroDescription = (s: Pick<HomeSettings, "hero_description"> | null | undefined): string => (s?.hero_description || "").trim() || DEFAULT_HERO_DESCRIPTION;

/** A problem with the hero text, or "". */
export function validateHeroText(headline: string, description: string): string {
  if (headline.length > HERO_HEADLINE_MAX) return `The headline is longer than ${HERO_HEADLINE_MAX} characters.`;
  if (description.length > HERO_DESCRIPTION_MAX) return `The description is longer than ${HERO_DESCRIPTION_MAX} characters.`;
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
