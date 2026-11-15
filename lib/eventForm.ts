import { sanitize } from "./sanitize";

// <input type="datetime-local"> works in local time; the database stores an absolute instant.
export const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const blankEvent = () => ({
  title: "", slug: "", subtitle: "", tagline: "", description: "", venue: "", venue_address: "", event_date: "", ends_at: "", registration_deadline: "", capacity: 100, ticket_prefix: "TICKET",
  registration_fee: 0, fee_note: "", hashtags: "", kit_inclusions: "", payment_account_name: "", payment_account_number: "", contact_links: "",
  registration_open: true, send_ack_email: false, receipt_retention_days: "", terms_html: "",
});

export const eventToForm = (e) => ({
  ...blankEvent(), ...e,
  slug: e.slug || "", subtitle: e.subtitle || "", tagline: e.tagline || "", description: e.description || "", venue: e.venue || "", venue_address: e.venue_address || "", fee_note: e.fee_note || "",
  event_date: toLocalInput(e.event_date), ends_at: toLocalInput(e.ends_at), registration_deadline: toLocalInput(e.registration_deadline),
  hashtags: (e.hashtags || []).join(" "), kit_inclusions: (e.kit_inclusions || []).join("\n"),
  payment_account_name: e.payment_account_name || "", payment_account_number: e.payment_account_number || "",
  contact_links: (e.contact_links || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
  receipt_retention_days: e.receipt_retention_days ?? "", terms_html: e.terms_html || "",
});

/** sanitized Terms HTML, or null when the editor holds no text */
export const cleanTerms = (html) => { const c = sanitize(html).trim(); return c.replace(/<[^>]*>|&nbsp;|\s/g, "") ? c : null; };

/** "Facebook | https://..." lines -> [{label, url}], or an error message */
export function parseLinks(text) {
  const out = [];
  for (const [i, line] of text.split("\n").map((l) => l.trim()).entries()) {
    if (!line) continue;
    const [label, ...rest] = line.split("|");
    const url = rest.join("|").trim();
    if (!label.trim() || !/^(https?:\/\/|mailto:)\S+$/i.test(url)) return { error: `Contact link line ${i + 1} should look like: Facebook | https://www.facebook.com/TeenfreshPH` };
    out.push({ label: label.trim(), url });
  }
  return { links: out };
}
