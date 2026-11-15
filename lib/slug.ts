// Readable addresses: /events/<slug> and /shop/<slug>. The database creates the slug (migration 032_slugs.sql); until that migration has run,
// rows have no slug and the site falls back to the id, so both kinds of address work.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string): boolean => UUID.test(s);

/** The same rule as public.slugify() in the database: lowercase letters and digits, words joined by hyphens. */
export const slugify = (t: string | null | undefined): string => String(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

interface Sluggable { id: string; slug?: string | null }
/** What goes in the address for a row: its slug, or its id when it has none yet. */
export const ref = (row: Sluggable): string => row.slug || row.id;
export const eventPath = (e: Sluggable): string => `/events/${ref(e)}`;
export const registerPath = (e: Sluggable): string => `/events/${ref(e)}/register`;
export const productPath = (p: Sluggable): string => `/shop/${ref(p)}`;

/** Finds a row by slug or by id (an old address). */
export const findByRef = <T extends Sluggable>(rows: T[], value: string): T | undefined => rows.find((r) => r.slug === value || r.id === value);
