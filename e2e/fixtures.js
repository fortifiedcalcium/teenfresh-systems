import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const ev = {
  id: "e1", title: "IVEMON: ODD PLATINUM Cupsleeve Event", subtitle: "IVE's Kim Gaeul Cupsleeve Event hosted by Teenfresh", event_date: future, ends_at: future, registration_deadline: future,
  venue: "Psicom Blue Club", venue_address: "6 Yale St., Cubao, Quezon City, Philippines, 1109", price_info: "100 PHP", capacity: 100, registration_open: true, ticket_prefix: "IVEMONOP", description: "", created_at: future,
  registration_fee: 100, fee_note: "exclusive of food and drinks", hashtags: ["#IVEMON_OP", "#Teenfresh", "#IVE", "#Gaeul"], kit_inclusions: ["(1) Cupsleeve", "(1) Trading Card", "(2) Mezastar Tags"],
  payment_account_name: "BR**N CA**O S.", payment_account_number: "09171234567", send_ack_email: false, receipt_retention_days: 30,
  contact_links: [{ label: "Facebook", url: "https://www.facebook.com/TeenfreshPH" }, { label: "X", url: "https://x.com/TeenfreshPH" }, { label: "Gmail", url: "mailto:teenfreshph@gmail.com" }],
  terms_html: '<p>Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before filling up the form.</p><ol><li>Be 101% sure before you place your order(s).</li><li>Strictly <strong>NO CANCELLATION</strong> of order(s) and/or <strong>REFUNDS</strong>.</li><li>1 Form = 1 Entry per person only.</li></ol>',
};
const payment = (over = {}) => ({ id: "p1", event_id: "e1", user_id: "u1", sender_name: "Juan D.", amount_paid: 100, reference_number: "1234567890123", receipt_path: "u1/00000000-0000-4000-8000-000000000001.png", receipt_history: [], reference_history: [], status: "pending", amount_due: null, review_note: null, resubmission_count: 0, created_at: future,
  sender_profile: { email: "juan@example.com", full_name: "Juan Dela Cruz" }, registrations: [{ id: "r1", name: "Juan Dela Cruz", x_username: "juan_dc", facebook_url: "https://www.facebook.com/juan", status: "pending_verification", ticket_number: null }], ...over });
const reg = { id: "r1", event_id: "e1", user_id: "u1", name: "Juan Dela Cruz", x_username: "juan_dc", email: "juan@example.com", contact_number: null, ticket_number: "IVEMON-000001", status: "confirmed", checked_in_at: null, kit_claimed: false, receipt_verified: false, created_at: future, checker: null, events: { title: ev.title, event_date: future, venue: ev.venue } };
const profiles = [{ id: "u1", email: "juan@example.com", full_name: "Juan Dela Cruz", role: "attendee", created_at: future }, { id: "u2", email: "admin@example.com", full_name: "Admin", role: "admin", created_at: future }];

const TABLES = {
  events: [ev, { ...ev, id: "e2", title: "A sold-out event", registration_fee: 0 }, { ...ev, id: "e3", title: "A closed event", registration_deadline: new Date(Date.now() - 864e5).toISOString() }],
  payments: [payment(), payment({ id: "p2", user_id: "u9", sender_name: "Maria S.", amount_paid: 80, reference_number: "9876543210987", registrations: [{ id: "r5", name: "Maria Santos", x_username: "maria", facebook_url: "https://www.facebook.com/maria", status: "pending_verification", ticket_number: null }] })],
  event_images: [],
  event_availability: [{ event_id: "e1", registered: 93 }, { event_id: "e2", registered: 100 }, { event_id: "e3", registered: 10 }],
  registrations: [{ ...reg, facebook_url: "https://www.facebook.com/juan", payment: { status: "verified", amount_paid: 100, reference_number: "1234567890123" }, payments: { id: "p1", status: "verified", review_note: null, amount_due: null, amount_paid: 100, reference_number: "1234567890123", sender_name: "Juan D." }, payment_id: "p1", events: { title: ev.title, event_date: future, venue: ev.venue, registration_fee: 100 } }, { ...reg, id: "r2", user_id: "u3", name: "Maria Santos", ticket_number: "IVEMON-000002", checked_in_at: future, checker: { full_name: "Admin", email: "admin@example.com" } }, { ...reg, id: "r3", user_id: "u1", name: "Maria Santos", x_username: "maria", ticket_number: null, status: "pending_verification", payment_id: "p3", payment: { status: "underpaid", amount_paid: 95, reference_number: "9876543210987" }, payments: { id: "p3", status: "underpaid", review_note: "A transaction fee was deducted", amount_due: 5, amount_paid: 95, reference_number: "9876543210987", sender_name: "Maria S." } }],
  registration_email_status: [{ registration_id: "r1", event_id: "e1", status: "sent", error: null, sent_at: future }],
  email_templates: [{ event_id: "e1", kind: "confirmation", subject: "Confirmation email - IVEMON", html_body: "<p>Hello {{Name}}</p>{{Terms}}", text_body: "Hello {{Name}}\n\n{{Terms}}" }],
  email_logs: [{ id: 1, registration_id: "r1", recipient: "juan@example.com", kind: "confirmation", status: "failed", error: "Resend 403", sent_at: future, registrations: { event_id: "e1", ticket_number: "IVEMON-000001", name: "Juan Dela Cruz" } }],
  attendance_logs: [{ id: 1, ticket_number_scanned: "IVEMON-000001", result: "success", scanned_at: future, registrations: { name: "Juan Dela Cruz", event_id: "e1" }, scanner: { full_name: "Admin", email: "admin@example.com" } }],
};

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

/** Fake Supabase: REST tables, RPCs, auth user and Edge Functions, all served from fixtures. */
async function mockSupabase(page, { role }) {
  const user = role ? { id: role === "admin" ? "u2" : "u1", aud: "authenticated", role: "authenticated", email: role === "admin" ? "admin@example.com" : "juan@example.com", app_metadata: {}, user_metadata: {}, created_at: future } : null;
  if (user) {
    await page.addInitScript(([key, session]) => { try { localStorage.setItem(key, JSON.stringify(session)); } catch { /* sandboxed frames (the email preview) have no storage */ } }, [
      "sb-localhost-auth-token",
      { access_token: "a.b.c", refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user },
    ]);
  }
  await page.route("http://localhost:54321/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
    if (url.pathname.startsWith("/auth/v1/user")) return json(user ?? { message: "no" }, user ? 200 : 401);
    if (url.pathname.startsWith("/functions/v1/")) return json({ results: [{ id: "r1", status: "sent" }] });
    // storage: receipts upload, signed URLs and the receipt image itself
    if (url.pathname.startsWith("/storage/v1/object/sign/") && req.method() === "POST") return json({ signedURL: url.pathname.replace("/storage/v1", "") + "?token=t" });   // createSignedUrl
    if (url.pathname.startsWith("/storage/v1/object/") && req.method() === "GET") return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "image/png" }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOUi2plwAaYsIoOWgkAyk8BDTx0sOwAAAAASUVORK5CYII=", "base64") });
    if (url.pathname.startsWith("/storage/v1/object/")) return json({ Key: url.pathname.split("/object/")[1] });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").pop();
      if (name === "check_in_attendee") return json({ result: "success", registration_id: "r1", name: "Juan Dela Cruz", x_username: "juan_dc", ticket_number: "IVEMON-000001", kit_claimed: false, receipt_verified: false, checked_in_by_name: "Admin" });
      if (name === "submit_registration") return json({ registration_id: "rnew", payment_id: "pnew", status: "pending_verification", ticket_number: null });
      if (name === "review_payment") return json({ decision: "verified", payment_id: "p1", registration_ids: ["r1"], ticket_numbers: ["IVEMONOP-000001"] });
      if (name === "resubmit_payment") return json({ payment_id: "p1", status: "pending" });
      return json(null);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").pop();
      if (table === "profiles") {
        const id = url.searchParams.get("id");
        const rows = id ? profiles.filter((p) => id === `eq.${p.id}`) : profiles;
        return (req.headers().accept || "").includes("vnd.pgrst.object") ? (rows[0] ? json(rows[0]) : json({ message: "none" }, 406)) : json(rows);
      }
      let rows = TABLES[table] ?? [];
      // apply PostgREST-style ?col=eq.value filters (supabase-js picks the first row client-side for .maybeSingle())
      for (const [k, val] of url.searchParams) if (val.startsWith("eq.") && !["select", "order", "limit"].includes(k)) rows = rows.filter((r) => String(r[k]) === val.slice(3));
      // the register page asks "am I already registered?": answer no so the form shows
      if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `0-0/${rows.length}` } });
      if ((req.headers().accept || "").includes("vnd.pgrst.object")) return rows[0] ? json(rows[0]) : json({ message: "none" }, 406);
      return json(rows, 200, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    return json({});
  });
}

export const test = base.extend({
  as: async ({ page }, use) => { await use(async (role) => mockSupabase(page, { role })); },
});
export { expect };

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
// Legacy mode scans the page without opening helper pages for iframes (the sandboxed email preview iframe is titled and
// holds only the email HTML, which is plain inline-styled markup).
export const newAxe = (page) => new AxeBuilder({ page }).setLegacyMode(true);
export const scan = async (page) => (await newAxe(page).withTags(AXE_TAGS).analyze()).violations;
export const formatViolations = (v) => v.map((x) => `${x.id} (${x.impact}): ${x.help}\n  ` + x.nodes.slice(0, 3).map((n) => n.target.join(" ") + "  " + (n.failureSummary || "").split("\n").slice(0, 2).join(" ")).join("\n  ")).join("\n");
