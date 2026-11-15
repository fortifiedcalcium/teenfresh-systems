// Security headers for every page the server renders. (Cloudflare's _headers file only covers static files, not pages the worker renders.)
// Scripts: only the site's own files, plus the small inline settings script Nuxt writes into each page, allowed by its sha256 hash, so
// `script-src` never needs 'unsafe-inline'. Everything else matches what the site has always sent.
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
};

export const cspFor = (scriptHashes: string[], supabaseOrigins = "https://*.supabase.co wss://*.supabase.co"): string => [
  "default-src 'self'",
  `script-src 'self'${scriptHashes.map((h) => ` '${h}'`).join("")}`,
  "style-src 'self'", "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co", "font-src 'self'",
  `connect-src 'self' ${supabaseOrigins}`,
  "media-src 'self' blob:", "worker-src 'self' blob:", "frame-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "upgrade-insecure-requests",
].join("; ");

/** The sha256 hashes ("sha256-…") of the inline <script> blocks that run code (not the JSON data blocks). */
export async function inlineScriptHashes(html: string): Promise<string[]> {
  const out: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/json|application\/ld\+json|importmap|speculationrules)")[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1].trim()) continue;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m[1]));
    out.push(`sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`);
  }
  return [...new Set(out)];
}
