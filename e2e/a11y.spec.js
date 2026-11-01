import { test, expect, scan, newAxe, formatViolations } from "./fixtures.js";

const ROUTES = [
  ["guest", "/", "Upcoming events"], ["guest", "/login", "Sign in"], ["guest", "/register", "Create an account"],
  ["guest", "/forgot-password", "Forgot your password?"], ["guest", "/reset-password", "Link expired"],
  ["user", "/events/e1/register", "Register"], ["user", "/events/e3/register", "Register"], ["user", "/my-registrations", "My registrations"], ["user", "/my-ticket/r1", "My ticket"],
  ["admin", "/admin", "Dashboard"], ["admin", "/admin/events", "Events"], ["admin", "/admin/payments", "Payments"], ["admin", "/admin/attendees", "Attendees"],
  ["admin", "/admin/scanner", "QR Scanner"], ["admin", "/admin/tracker", "Attendance"], ["admin", "/admin/emails", "Email"], ["admin", "/admin/users", "Admin users"],
];

test.describe("axe: wcag2a / wcag2aa / wcag21aa / wcag22aa on every route", () => {
  for (const [who, path, h1] of ROUTES) {
    test(`${path} (${who})`, async ({ page, as }) => {
      await as(who === "guest" ? null : who);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const violations = await scan(page);
      expect(violations, formatViolations(violations)).toEqual([]);
      await expect(page).toHaveTitle(/· Teenfresh Events$|Teenfresh Events/);
    });
  }

  test("event cards are all the same size, even across rows and with different content", async ({ page, as }) => {
    await as(null);
    await page.setViewportSize({ width: 800, height: 900 }); // two columns: two rows, the second holds the closed event
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Upcoming events" })).toBeVisible();
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(3);
    await page.waitForLoadState("networkidle");
    const sizes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    expect(new Set(sizes.map((s) => s[1])).size, JSON.stringify(sizes)).toBe(1);
    expect(new Set(sizes.map((s) => s[0])).size, JSON.stringify(sizes)).toBe(1);
  });

  test("dialogs, error states and result panels", async ({ page, as }) => {
    await as("admin");
    await page.goto("/admin/events");
    await page.getByRole("button", { name: /New event/ }).click();
    await expect(page.getByRole("dialog", { name: "New event" })).toBeVisible();
    let v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/admin/scanner");
    await page.getByLabel("Ticket number").fill("ivemon-000001");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Valid ticket" })).toBeVisible();
    v = await scan(page); expect(v, formatViolations(v)).toEqual([]);

    await page.goto("/admin/emails");
    for (const tab of ["Bulk mail merge", "Email logs"]) { await page.getByRole("tab", { name: tab }).click(); v = await scan(page); expect(v, tab + "\n" + formatViolations(v)).toEqual([]); }
  });

  test("registration: all four steps, errors, review and the status page", async ({ page, as }) => {
    await as("user");
    await page.goto("/events/e1/register");
    await expect(page.getByRole("heading", { level: 2, name: "Event info and terms" })).toBeVisible();
    let v = await scan(page); expect(v, "step 1\n" + formatViolations(v)).toEqual([]);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "step 1 errors\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("checkbox", { name: /agree/ }).check();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Participant's information" })).toBeFocused();
    v = await scan(page); expect(v, "step 2\n" + formatViolations(v)).toEqual([]);
    await page.getByLabel(/^Name/).fill("Juan Dela Cruz");
    await page.getByLabel(/^X\/Twitter Username/).fill("@juan_dc");
    await page.getByLabel(/^Contact Number/).fill("12345");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "step 2 errors\n" + formatViolations(v)).toEqual([]);
    await page.getByLabel(/^Facebook Profile Link/).fill("fb.com/TeenfreshPH");
    await page.getByLabel(/^Contact Number/).fill("09171234567");
    await page.getByRole("button", { name: "Next" }).click();

    // kit and quantity
    await expect(page.getByRole("heading", { level: 2, name: "Kit and quantity" })).toBeFocused();
    v = await scan(page); expect(v, "kit step\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Next" }).click();                                   // nothing chosen yet
    await expect(page.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "kit step errors\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("radio", { name: /^Deluxe kit/ }).check();
    await page.getByLabel(/^Quantity/).fill("3");                                               // above this kit's limit of 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/up to 2 of this kit per form/).first()).toBeVisible();
    await page.getByRole("radio", { name: /^Standard kit/ }).check();
    await page.getByLabel(/^Quantity/).fill("2");
    await expect(page.getByText("Total to pay: 2 × ₱100.00 = ₱200.00")).toBeVisible();
    v = await scan(page); expect(v, "kit step with a total\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Payment" })).toBeFocused();
    v = await scan(page); expect(v, "step 3\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Review registration" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "step 3 errors\n" + formatViolations(v)).toEqual([]);
    await page.getByLabel(/^Name of Sender/).fill("Juan D.");
    await page.getByLabel(/^Amount Paid/).fill("200");
    await page.getByLabel(/^Reference Number/).fill("1234567890123");
    await page.locator("#receipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOUi2plwAaYsIoOWgkAyk8BDTx0sOwAAAAASUVORK5CYII=", "base64") });
    await expect(page.getByAltText("Preview of your receipt")).toBeVisible();
    v = await scan(page); expect(v, "step 3 with a receipt\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Review registration" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Review and submit" })).toBeFocused();
    v = await scan(page); expect(v, "step 4\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Submit registration" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registration received" })).toBeFocused();
    await expect(page.getByText(/within 48 to 72 hours/)).toBeVisible();
    v = await scan(page); expect(v, "status page\n" + formatViolations(v)).toEqual([]);
  });

  test("admin: payment review dialogs, the Media tab, and resubmitting a payment", async ({ page, as }) => {
    await as("admin");
    await page.goto("/admin/payments");
    await page.getByRole("button", { name: /Review payment of Juan D./ }).click();
    const dialog = page.getByRole("dialog", { name: /Payment of/ });
    await expect(dialog.getByAltText(/GCash receipt/)).toBeVisible();
    let v = await scan(page); expect(v, "review dialog\n" + formatViolations(v)).toEqual([]);
    await dialog.getByRole("button", { name: "Reject payment" }).click();
    await expect(page.getByRole("dialog", { name: "Reject this payment?" })).toBeVisible();
    v = await scan(page); expect(v, "confirm dialog\n" + formatViolations(v)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Reject this payment?" })).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await page.goto("/admin/events");
    await page.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }).click();
    await expect(page.getByRole("dialog", { name: "Edit event" })).toBeVisible();
    v = await scan(page); expect(v, "event editor\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("tab", { name: "Kits" }).click();
    await expect(page.getByRole("textbox", { name: /^Name/ }).first()).toHaveValue("Standard kit");
    v = await scan(page); expect(v, "kits tab\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: "Add a kit" }).click();
    await page.getByRole("button", { name: "Save kits" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "kits tab errors\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("tab", { name: "Media" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Event poster" })).toBeVisible();
    v = await scan(page); expect(v, "media tab\n" + formatViolations(v)).toEqual([]);
  });

  test("my registrations: statuses and the payment resubmission dialog", async ({ page, as }) => {
    await as("user");
    await page.goto("/my-registrations");
    await expect(page.getByRole("heading", { level: 1, name: "My registrations" })).toBeVisible();
    await expect(page.getByRole("link", { name: /View ticket/ }).first()).toBeVisible();
    await expect(page.getByText(/Payment incomplete: ₱5.00 still due/)).toBeVisible();
    let v = await scan(page); expect(v, "list\n" + formatViolations(v)).toEqual([]);
    await page.getByRole("button", { name: /Send the missing amount for Maria Santos/ }).click();
    const dialog = page.getByRole("dialog", { name: "Send the missing amount" });
    await expect(dialog).toBeVisible();
    v = await scan(page); expect(v, "resubmit dialog\n" + formatViolations(v)).toEqual([]);
    await dialog.getByRole("button", { name: "Send for review" }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "problem" })).toBeFocused();
    v = await scan(page); expect(v, "resubmit errors\n" + formatViolations(v)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("WCAG behaviours", () => {
  test("skip link is the first tab stop and moves focus to main", async ({ page, as }) => {
    await as(null);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // wait for the app to render before tabbing
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("keyboard focus is always visible: 3px ink outline", async ({ page, as }) => {
    await as(null);
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel(/^Email/).focus();
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { w: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor, offset: s.outlineOffset }; });
    expect(outline).toMatchObject({ w: "3px", style: "solid", offset: "2px" });
    expect(outline.color).toBe("rgb(23, 48, 63)"); // --ink
  });

  test("navigating moves focus to the new page's h1 and sets the title", async ({ page, as }) => {
    await as(null);
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeFocused();
    await expect(page).toHaveTitle("Sign in · Teenfresh Events");
  });

  test("reflow at 320 CSS px: no horizontal page scroll", async ({ page, as }) => {
    for (const [who, path] of [[null, "/"], [null, "/login"], ["user", "/events/e1/register"], ["admin", "/admin"], ["admin", "/admin/attendees"], ["admin", "/admin/scanner"]]) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await as(who);
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test("target size: buttons and links are at least 24px, primary controls 44px", async ({ page, as }) => {
    await as("admin");
    for (const path of ["/", "/admin", "/admin/attendees", "/admin/scanner"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const small = await page.evaluate(() => [...document.querySelectorAll("button, [role=button], input:not([type=hidden]), select, textarea, .btn-primary, .btn-secondary, nav a")]
        .filter((e) => e.offsetParent !== null && !e.closest(".sr-only") && !e.classList.contains("skip-link") && !e.classList.contains("check"))
        .map((e) => { const r = e.getBoundingClientRect(); return { t: e.outerHTML.slice(0, 70), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((x) => x.w < 44 || x.h < 44));
      expect(small, `${path}: controls under 44px`).toEqual([]);
    }
  });

  test("reduced motion removes animation and transitions", async ({ page, as }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await as(null);
    await page.goto("/");
    const d = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("a.btn-primary, a.nav-link")).transitionDuration));
    expect(d).toBeLessThan(0.001);
  });

  test("forced colors (Windows High Contrast): still no violations, badges and progress keep borders", async ({ page, as }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await as(null);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const border = await page.evaluate(() => getComputedStyle(document.querySelector(".badge")).borderTopWidth);
    expect(border).toBe("2px");
    // axe cannot evaluate colour contrast under forced-colors (the author colours are replaced), so only structure is scanned here
    const v = (await newAxe(page).disableRules(["color-contrast"]).analyze()).violations; expect(v, formatViolations(v)).toEqual([]);
  });

  test("prefers-contrast: more strengthens borders to ink", async ({ page, as }) => {
    await page.emulateMedia({ contrast: "more" });
    await as(null);
    await page.goto("/");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--border-ui").trim())).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()));
  });

  test("200% zoom is usable (viewport halved) with no horizontal scroll", async ({ page, as }) => {
    await as(null);
    await page.setViewportSize({ width: 640, height: 400 }); // 1280px at 200% zoom
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("body text is at least 16px", async ({ page, as }) => {
    await as(null);
    await page.goto("/login");
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Source Sans 3");
  });
});
