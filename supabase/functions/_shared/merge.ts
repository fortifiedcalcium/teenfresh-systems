// Pure TypeScript (no Deno APIs) so the Edge Functions AND the browser preview use the same code.

export const MERGE_FIELDS = [
  "Name", "X/Twitter Username", "Ticket Number", "Event Title", "Event Subtitle", "Event Date", "Venue",
  "Registration Fee", "Kit", "Quantity", "Unit Price", "Total Amount", "Terms", "Contact Links", "Banner", "QR Code", "QR Code URL", "Banner URL", "Logo URL", "Facebook Icon URL", "X Icon URL", "Site URL",
  "Reference Number", "Amount Paid", "Amount Due", "Reason",
] as const;

// Fields whose value is already-safe HTML (built from escaped or sanitized parts) and must not be escaped again.
const RAW_HTML_FIELDS = new Set(["terms", "contact links", "banner", "qr code"]);

const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ");

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export type MergeValues = Record<string, string>; // keys are merge-field names

/** Replaces {{Field}} markers. Unknown fields become "". Values are inserted once (never re-expanded),
 *  and HTML-escaped in html mode, so a name like "{{Terms}}" or "<script>" cannot do anything. */
export function renderTemplate(template: string, values: MergeValues, mode: "html" | "text"): string {
  const table = new Map(Object.entries(values).map(([k, v]) => [norm(k), v ?? ""]));
  return String(template ?? "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, key: string) => {
    const k = norm(key);
    const v = table.get(k) ?? "";
    return mode === "html" && !RAW_HTML_FIELDS.has(k) ? escapeHtml(v) : v;
  });
}

/* ------------------------------------------------------------------ HTML sanitizer (whitelist) */
// Admin-edited terms are HTML. This keeps a small set of formatting tags, drops every attribute except a
// safe http(s)/mailto href on links, removes scripts and friends with their content, and balances the tags.
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "span"]);
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s"'<>]*$/i;
const EMAIL_LINK = "color:#1c5a85;text-decoration:underline;";
const EMAIL_STYLES: Record<string, string> = {
  p: "margin:0 0 12px 0;", ul: "margin:0 0 12px 0;padding:0 0 0 18px;", ol: "margin:0 0 12px 0;padding:0 0 0 18px;", li: "margin:0 0 12px 0;", a: EMAIL_LINK,
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&#(\d{1,7});/g, (_m, d) => String.fromCodePoint(Number(d) || 32))
    .replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&");
}

const escapeText = (t: string) =>
  t.replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|#\d{1,6}|#x[0-9a-f]{1,6});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeHtml(input: string, opts: { email?: boolean } = {}): string {
  const src = String(input ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|template|noscript|form|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, "");
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack: string[] = [];
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    out += escapeText(src.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    if (name === "br") { if (!closing) out += "<br>"; continue; }
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at === -1) continue;                       // a close tag with no matching open tag
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    let attrs = "";
    if (name === "a") {
      const h = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3]);
      const url = decodeEntities((h?.[1] ?? h?.[2] ?? h?.[3] ?? "").trim());
      if (url && SAFE_HREF.test(url)) attrs = ` href="${escapeHtml(url)}" rel="noopener noreferrer"`;
    }
    const style = opts.email && EMAIL_STYLES[name] ? ` style="${EMAIL_STYLES[name]}"` : "";
    out += `<${name}${attrs}${style}>`;
    stack.push(name);
  }
  out += escapeText(src.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

/** Plain-text version of (sanitized) HTML: numbered and bulleted lists, paragraphs, "label (url)" links. */
export function htmlToText(html: string): string {
  let s = sanitizeHtml(html);
  s = s.replace(/<ol>([\s\S]*?)<\/ol>/g, (_m, inner: string) => { let n = 0; return "\n" + inner.replace(/<li>/g, () => `\n${++n}. `) + "\n"; });
  s = s.replace(/<ul>/g, "\n").replace(/<li>/g, "\n- ");
  s = s.replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_m, href: string, label: string) => {
    const url = decodeEntities(href);
    return label.trim() === url || label.trim() === url.replace(/^mailto:/, "") ? label : `${label} (${url})`;
  });
  s = s.replace(/<br>/g, "\n").replace(/<p>/g, "\n\n").replace(/<\/ul>/g, "\n\n").replace(/<\/li>/g, "").replace(/<[^>]+>/g, "");
  return decodeEntities(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ------------------------------------------------------------------ event-derived blocks */
export function termsHtml(intro: string | null, items: string[]): string {
  const li = items.map((t) => `<li style="margin:0 0 12px 0;">${escapeHtml(t)}</li>`).join("");
  return `<div style="margin:0 0 16px 24px;padding:0 0 0 16px;border-left:3px solid #dadce0;color:#222222;">` +
    (intro ? `<p style="margin:0 0 12px 0;">${escapeHtml(intro)}</p>` : "") +
    `<ul style="margin:0;padding:0 0 0 18px;">${li}</ul></div>`;
}

export function termsText(intro: string | null, items: string[]): string {
  const body = items.map((t) => `    - ${t}`).join("\n\n");
  return (intro ? `    ${intro}\n\n` : "") + body;
}

export interface ContactLink { label: string; url: string }
export function contactLinks(raw: unknown): ContactLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ label: String((l as ContactLink)?.label ?? "").trim(), url: String((l as ContactLink)?.url ?? "").trim() }))
    .filter((l) => l.label && SAFE_HREF.test(l.url));
}
const linkText = (url: string) => url.replace(/^mailto:/i, "");
export const contactLinksHtml = (raw: unknown) =>
  contactLinks(raw).map((l) => `${escapeHtml(l.label)}: <a href="${escapeHtml(l.url)}" style="${EMAIL_LINK}">${escapeHtml(linkText(l.url))}</a>`).join("<br>");
export const contactLinksText = (raw: unknown) => contactLinks(raw).map((l) => `${l.label}: ${linkText(l.url)}`).join("\n");

export const formatEventDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
  } catch { return String(iso); }
};

/** Relative image paths (e.g. /banners/x.png) become absolute so email clients can load them. */
export const absoluteUrl = (url: string | null | undefined, site: string): string => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (site || "").replace(/\/+$/, "");
  return base + (url.startsWith("/") ? "" : "/") + url;
};

export interface MergeSource {
  reg: { name?: string; x_username?: string; ticket_number?: string | null; kit_name?: string | null; kit_quantity?: number | null; kit_unit_price?: number | string | null; total_amount?: number | string | null };
  event: {
    title?: string; subtitle?: string | null; event_date?: string; venue?: string | null; banner_url?: string | null;
    registration_fee?: number | string | null; terms_html?: string | null; terms_intro?: string | null; terms_items?: string[] | null; contact_links?: unknown;
  };
  site?: string;
  bannerUrl?: string | null;   // the resolved email_banner / banner image (falls back to event.banner_url)
  bannerAlt?: string | null;
  qrUrl?: string | null;       // the ticket QR image (PNG with the logo), hosted so every mail app can load it
  ensureQr?: boolean;          // confirmation emails: add the QR block when the template has no {{QR Code}}
  extra?: { reason?: string | null; amount_paid?: number | string | null; amount_due?: number | string | null; reference_number?: string | null };
}

const money = (v: unknown) => (v == null || v === "" ? "" : Number(v).toFixed(2));

/** The emailed QR code: the image (scannable at the entrance) with the ticket number beneath it as the text alternative. */
export const qrBlock = (url: string, ticket: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;"><tr><td style="padding:12px;border:1px solid #dadce0;border-radius:8px;text-align:center;background:#ffffff;">`
  + `<p style="margin:0 0 8px 0;font-weight:bold;">Your QR code</p>`
  + `<img src="${escapeHtml(url)}" alt="Ticket QR code for ${escapeHtml(ticket)}" width="220" height="220" style="display:block;width:220px;height:220px;border:0;margin:0 auto;">`
  + `<p style="margin:8px 0 0 0;font-size:13px;color:#555555;">${escapeHtml(ticket)}<br>Show this at the entrance to check in.</p></td></tr></table>`;

/** Confirmation templates saved before the QR code existed have no {{QR Code}}: put it before the Terms (or at the end). */
export function withQrBlock(html: string): string {
  if (/\{\{\s*QR Code\s*\}\}/i.test(html)) return html;
  if (/\{\{\s*Terms\s*\}\}/i.test(html)) return html.replace(/\{\{\s*Terms\s*\}\}/i, "{{QR Code}}\n{{Terms}}");
  return html + "\n{{QR Code}}";
}

/** One value map per mode, because {{Terms}}, {{Banner}} and {{Contact Links}} differ between html and text. */
/** Where the logo and social icons of the signature are hosted. Email clients cannot load a relative path, and a stale
 *  PUBLIC_SITE_URL secret (e.g. the old Vercel address) points at a site that no longer serves them, so the signature
 *  lost its logo and icons. These brand images therefore always come from here; PUBLIC_SITE_URL still builds other links. */
export const DEFAULT_SITE = "https://teenfresh-events.web.app";

export function buildValues({ reg, event, site: siteIn = "", bannerUrl, bannerAlt, qrUrl, extra = {} }: MergeSource, mode: "html" | "text"): MergeValues {
  const site = siteIn?.trim() ? siteIn.trim().replace(/\/+$/, "") : DEFAULT_SITE;
  const banner = absoluteUrl(bannerUrl ?? event.banner_url, site);
  const items = event.terms_items ?? [];
  let terms: string;
  if (event.terms_html) {
    terms = mode === "html"
      ? `<div style="margin:0 0 16px 24px;padding:0 0 0 16px;border-left:3px solid #dadce0;color:#222222;">${sanitizeHtml(event.terms_html, { email: true })}</div>`
      : htmlToText(event.terms_html).split("\n").map((l) => (l ? "    " + l : l)).join("\n");
  } else {
    terms = mode === "html" ? termsHtml(event.terms_intro ?? null, items) : termsText(event.terms_intro ?? null, items);
  }
  return {
    "Name": reg.name ?? "",
    "X/Twitter Username": reg.x_username ? "@" + reg.x_username.replace(/^@+/, "") : "",
    "Ticket Number": reg.ticket_number ?? "",
    "Event Title": event.title ?? "",
    "Event Subtitle": event.subtitle ?? "",
    "Event Date": formatEventDate(event.event_date),
    "Venue": event.venue ?? "",
    "Registration Fee": money(event.registration_fee),
    "Kit": reg.kit_name ?? "",
    "Quantity": reg.kit_quantity ? String(reg.kit_quantity) : "",
    "Unit Price": money(reg.kit_unit_price),
    "Total Amount": money(reg.total_amount),
    "Terms": terms,
    "Contact Links": mode === "html" ? contactLinksHtml(event.contact_links) : contactLinksText(event.contact_links),
    "Banner": mode === "html" && banner
      ? `<img src="${escapeHtml(banner)}" alt="${escapeHtml(bannerAlt || event.title || "")}" width="800" style="display:block;width:100%;max-width:800px;height:auto;border:0;margin:0 0 20px 0;">`
      : "",
    "QR Code": mode === "html" && qrUrl ? qrBlock(qrUrl, reg.ticket_number ?? "") : "",
    "QR Code URL": qrUrl ?? "",
    "Banner URL": banner,
    "Logo URL": absoluteUrl("/email/logo.png", DEFAULT_SITE),
    "Facebook Icon URL": absoluteUrl("/email/facebook.png", DEFAULT_SITE),
    "X Icon URL": absoluteUrl("/email/x.png", DEFAULT_SITE),
    "Site URL": site,
    "Reference Number": extra.reference_number ?? "",
    "Amount Paid": money(extra.amount_paid),
    "Amount Due": money(extra.amount_due),
    "Reason": extra.reason ?? "",
  };
}

export interface Template { subject: string; html_body: string; text_body: string }

export function renderEmail(tpl: Template, src: MergeSource) {
  return {
    subject: renderTemplate(tpl.subject, buildValues(src, "text"), "text").replace(/[\r\n]+/g, " ").trim(),
    html: renderTemplate(src.ensureQr && src.qrUrl ? withQrBlock(tpl.html_body) : tpl.html_body, buildValues(src, "html"), "html"),
    text: renderTemplate(tpl.text_body, buildValues(src, "text"), "text"),
  };
}

export const SAMPLE_REG = { name: "Juan Dela Cruz", x_username: "juandelacruz", ticket_number: "TEST-000000", kit_name: "Event kit", kit_quantity: 2, kit_unit_price: 100, total_amount: 200 };
export const SAMPLE_EXTRA = { reason: "The reference number on the receipt does not match.", amount_paid: 95, amount_due: 5, reference_number: "1234567890123" };
