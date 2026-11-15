import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { TABLES, profiles, future } from "./data.js";

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
  // The "visual" tests run against the production build, whose Content-Security-Policy names the real Supabase hosts. Point it at the local fake
  // Supabase instead (the same change csp.spec.js makes), or the browser would refuse to talk to the mock.
  localSupabaseCsp: [async ({ page }, use, testInfo) => {
    if (testInfo.project.name === "visual") {
      await page.route("http://localhost:5198/**", async (route) => {
        if (route.request().resourceType() !== "document") return route.fallback();
        const res = await route.fetch();
        const csp = (res.headers()["content-security-policy"] || "").replaceAll("https://*.supabase.co", "http://localhost:54321").replaceAll("wss://*.supabase.co", "ws://localhost:54321").replace("; upgrade-insecure-requests", "").replace("style-src 'self';", "style-src 'self' 'unsafe-inline';");   // (tests inject small style tags)
        await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": csp } });
      });
    }
    await use();
  }, { auto: true }],
});
export { expect };

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
// Legacy mode scans the page without opening helper pages for iframes (the sandboxed email preview iframe is titled and
// holds only the email HTML, which is plain inline-styled markup).
export const newAxe = (page) => new AxeBuilder({ page }).setLegacyMode(true);
export const scan = async (page) => (await newAxe(page).withTags(AXE_TAGS).analyze()).violations;
export const formatViolations = (v) => v.map((x) => `${x.id} (${x.impact}): ${x.help}\n  ` + x.nodes.slice(0, 3).map((n) => n.target.join(" ") + "  " + (n.failureSummary || "").split("\n").slice(0, 2).join(" ")).join("\n  ")).join("\n");

/** Waits until the Matahari font has really loaded (document.fonts.load can answer before the @font-face rule exists on a busy dev server). */
export const fontsReady = async (page) => { await page.waitForLoadState("networkidle"); await page.waitForFunction(async () => (await Promise.all(["400", "700", "800", "900"].map((w) => document.fonts.load(`${w} 16px Matahari`)))).every((r) => r.length > 0), null, { timeout: 15000 }); };
