// sitemap.xml: the home page, the shop, and every event and product (by slug). Read from the same public tables the site shows.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export default defineEventHandler(async (event) => {
  const { siteUrl, supabaseUrl, supabaseKey } = useRuntimeConfig(event).public;
  const base = String(siteUrl).replace(/\/$/, "");
  const get = async (path: string): Promise<{ id: string; slug?: string; created_at?: string }[]> => {
    try { return await $fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: String(supabaseKey), authorization: `Bearer ${supabaseKey}` } }); } catch { return []; }
  };
  // Until migration 032 has run there is no slug column: ask again without it, and use the ids.
  const withFallback = async (table: string, withSlug: string, without: string) => { const rows = await get(`${table}?select=${withSlug}`); return rows.length ? rows : get(`${table}?select=${without}`); };
  const [events, products] = await Promise.all([withFallback("events", "id,slug,created_at&order=event_date", "id,created_at&order=event_date"), withFallback("products", "id,slug,created_at&active=eq.true&order=created_at.desc", "id,created_at&active=eq.true&order=created_at.desc")]);
  const url = (loc: string, lastmod?: string) => `  <url><loc>${esc(base + loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;
  const body = [url("/"), url("/shop"), ...events.map((e) => url(`/events/${e.slug || e.id}`, e.created_at)), ...products.map((p) => url(`/shop/${p.slug || p.id}`, p.created_at))].join("\n");
  setResponseHeaders(event, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
});
