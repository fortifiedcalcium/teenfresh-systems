import fs from "node:fs";
import { test as base, expect } from "./fixtures.js";

// Runs the REAL production build with the REAL headers from firebase.json enforced, and fails on any CSP violation.
// (The only change: https://*.supabase.co becomes the local fake Supabase, so the mocked API is reachable.)
const cfg = JSON.parse(fs.readFileSync(new URL("../firebase.json", import.meta.url), "utf8")).hosting;
const all = cfg.headers.find((h) => h.source === "**").headers;
const header = (k) => all.find((h) => h.key === k).value;
const CSP = header("Content-Security-Policy").replaceAll("https://*.supabase.co", "http://localhost:54321").replaceAll("wss://*.supabase.co", "ws://localhost:54321").replace("; upgrade-insecure-requests", "");

const test = base.extend({
  violations: async ({ page }, use) => {
    const seen = [];
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective}: ${e.blockedURI || "inline"} (${e.sourceFile || ""}:${e.lineNumber || ""})`));
    });
    page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.push("console: " + m.text().slice(0, 240)); });
    // serve the app's HTML (and the srcdoc/iframe documents inherit it) with the policy and the other headers applied
    await page.route("http://localhost:5198/**", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": CSP, "x-frame-options": header("X-Frame-Options"), "x-content-type-options": header("X-Content-Type-Options"), "referrer-policy": header("Referrer-Policy"), "permissions-policy": header("Permissions-Policy") } });
    });
    await use(async () => [...seen, ...(await page.evaluate(() => window.__csp || []).catch(() => []))]);
  },
});

test.describe("security headers", () => {
  test("firebase.json sets the headers, and the policy has no unsafe-eval, no unsafe-inline scripts and no wildcard sources", () => {
    expect(CSP).toContain("script-src 'self';");
    for (const bad of ["'unsafe-eval'", "script-src 'self' 'unsafe-inline'", "default-src *", " * ", "data: https:"]) expect(header("Content-Security-Policy"), bad).not.toContain(bad);
    expect(header("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(header("Content-Security-Policy")).toContain("object-src 'none'");
    expect(header("Content-Security-Policy")).toContain("upgrade-insecure-requests");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Permissions-Policy")).toContain("camera=(self)");
    expect(header("Permissions-Policy")).toContain("microphone=()");
    expect(header("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(header("Cache-Control")).toBe("no-cache");                                          // HTML is always revalidated
    const assets = cfg.headers.find((h) => h.source === "/assets/**");
    expect(assets.headers[0].value).toContain("immutable");                                   // fingerprinted files are cached for a year
    // hosting itself: the built app is served from dist, every route falls back to index.html, on the teenfresh-events site
    expect(cfg).toMatchObject({ site: "teenfresh-events", public: "dist", rewrites: [{ source: "**", destination: "/index.html" }] });
  });

  test("public pages work under the policy", async ({ page, as, violations }) => {
    await as(null);
    for (const [path, h1] of [["/", "Upcoming events"], ["/login", "Sign in"], ["/register", "Create an account"], ["/forgot-password", "Forgot your password?"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
    }
    await page.goto("/");
    await expect(page.locator("img[alt='']").first()).toBeVisible();                         // the logo (a bundled asset) still loads
    // fonts: Source Sans 3 is served from the app itself
    expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'Source Sans 3'"); })).toBe(true);
    expect(await violations()).toEqual([]);
  });

  test("the whole registration flow works under the policy, including the receipt preview", async ({ page, as, violations }) => {
    await as("user");
    await page.goto("/events/e1/register");
    await page.getByRole("checkbox", { name: /agree/ }).check();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel(/^Name/).fill("Juan Dela Cruz");
    await page.getByLabel(/^X\/Twitter Username/).fill("juan_dc");
    await page.getByLabel(/^Facebook Profile Link/).fill("fb.com/TeenfreshPH");
    await page.getByLabel(/^Contact Number/).fill("09171234567");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel(/^Name of Sender/).fill("Juan D.");
    await page.getByLabel(/^Amount Paid/).fill("100");
    await page.getByLabel(/^Reference Number/).fill("1234567890123");
    await page.locator("#receipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOUi2plwAaYsIoOWgkAyk8BDTx0sOwAAAAASUVORK5CYII=", "base64") });
    await expect(page.getByAltText("Preview of your receipt")).toBeVisible();                 // a blob: image is allowed
    await page.getByRole("button", { name: "Review registration" }).click();
    await page.getByRole("button", { name: "Submit registration" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registration received" })).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  test("admin pages work under the policy: payment review with a receipt image, the email preview iframe, the Media tab", async ({ page, as, violations }) => {
    await as("admin");
    await page.goto("/admin/payments");
    await page.getByRole("button", { name: /Review payment of Juan D./ }).click();
    const img = page.getByRole("dialog", { name: /Payment of/ }).getByAltText(/GCash receipt/);
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);   // the signed-URL image actually loaded (not blocked by the policy)
    await img.click();
    await expect(page.getByRole("dialog", { name: "Payment receipt" })).toBeVisible();        // the lightbox
    await page.keyboard.press("Escape");

    await page.goto("/admin/emails");
    const frame = page.frameLocator("iframe[title='Email preview']");
    await expect(frame.locator("body")).toContainText("Hello");
    // inline style="" attributes inside the sandboxed preview are allowed (style-src-attr), so the email renders as sent
    expect(await frame.locator("p, div").first().evaluate((el) => getComputedStyle(el).fontFamily !== "")).toBe(true);

    await page.goto("/admin/events");
    await page.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }).click();
    await page.getByRole("tab", { name: "Media" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Event poster" })).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  test("the QR scanner can open the camera (Permissions-Policy allows camera=(self))", async ({ page, as, violations }) => {
    await as("admin");
    await page.goto("/admin/scanner");
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#qr-region video")).toBeVisible();                              // a live video from the (fake) camera
    expect(await violations()).toEqual([]);
  });

  test("the app cannot be framed by another site", async ({ page, as }) => {
    await as(null);
    // a page that tries to embed the app in an iframe: the browser must refuse to show it
    await page.route("http://evil.test/**", (route) => route.fulfill({ contentType: "text/html", body: '<iframe id="f" src="http://localhost:5198/" width="600" height="400"></iframe>' }));
    await page.goto("http://evil.test/");
    await page.waitForTimeout(1500);
    const framed = page.frames().find((f) => f !== page.mainFrame());
    expect(framed, "an iframe was created").toBeTruthy();
    expect(await framed.content().catch(() => "")).not.toContain("Teenfresh");
    expect(framed.url()).not.toBe("http://localhost:5198/");
  });
});
