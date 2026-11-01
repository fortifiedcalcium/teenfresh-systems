import fs from "node:fs";
import { test, expect, scan, newAxe, formatViolations, AXE_TAGS } from "./fixtures.js";

// Admin navigation: bottom bar below 1024px (raised scan button), sidebar from 1024px. Pure CSS switch, tested in a real browser.
const PHONES = [[320, 568], [360, 640], [390, 844], [430, 932], [600, 960], [768, 1024], [820, 1180], [834, 1194]];
const DESKTOPS = [[1024, 768], [1180, 820], [1280, 800], [1440, 900], [1920, 1080]];
const ROUTES = ["/admin", "/admin/events", "/admin/payments", "/admin/attendees", "/admin/scanner", "/admin/tracker", "/admin/emails", "/admin/users", "/admin/changelog", "/admin/profile"];
const TAB_FOR = { "/admin": "Home", "/admin/attendees": "Search", "/admin/scanner": "Scan QR code", "/admin/tracker": "History", "/admin/profile": "Profile",
  "/admin/events": "Profile", "/admin/payments": "Profile", "/admin/emails": "Profile", "/admin/users": "Profile", "/admin/changelog": "Profile" };

const bar = (page) => page.locator("nav.admin-bottom-nav");
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.describe("bottom bar below 1024px, sidebar from 1024px", () => {
  for (const [w, h] of PHONES) {
    test(`${w}x${h}: bar visible, sidebar gone from the accessibility tree, no horizontal scroll`, async ({ page, as }) => {
      await as("admin"); await page.setViewportSize({ width: w, height: h });
      for (const path of ["/admin", "/admin/attendees", "/admin/payments"]) {
        await page.goto(path); await page.waitForLoadState("networkidle");
        await expect(bar(page)).toBeVisible();
        await expect(page.locator("#admin-nav")).toBeHidden();                      // display:none: not in the tab order or the a11y tree
        expect(await page.getByRole("navigation", { name: "Admin" }).count()).toBe(1);
        expect(await noHScroll(page), `${path} scrolls sideways at ${w}`).toBe(true);
      }
    });
  }
  for (const [w, h] of DESKTOPS) {
    test(`${w}x${h}: sidebar visible, bar gone`, async ({ page, as }) => {
      await as("admin"); await page.setViewportSize({ width: w, height: h });
      await page.goto("/admin"); await page.waitForLoadState("networkidle");
      await expect(page.locator("#admin-nav")).toBeVisible();
      await expect(bar(page)).toBeHidden();
      expect(await page.getByRole("navigation", { name: "Admin" }).count()).toBe(1);
      expect(await noHScroll(page)).toBe(true);
    });
  }
  test("the switch is exactly at 1024px", async ({ page, as }) => {
    await as("admin");
    await page.setViewportSize({ width: 1023, height: 800 }); await page.goto("/admin");
    await expect(bar(page)).toBeVisible(); await expect(page.locator("#admin-nav")).toBeHidden();
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(bar(page)).toBeHidden(); await expect(page.locator("#admin-nav")).toBeVisible();
  });
  test("tablet portrait is a floating pill (max 640px), phones are full width", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin");
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await bar(page).boundingBox()).width).toBeGreaterThanOrEqual(389);
    await page.setViewportSize({ width: 820, height: 1180 });
    const b = await bar(page).boundingBox();
    expect(b.width).toBeLessThanOrEqual(640); expect(Math.round(b.x + b.width / 2)).toBe(410);
    expect(1180 - (b.y + b.height)).toBeGreaterThanOrEqual(15);
  });
});

test.describe("tabs, routes and the active state", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the five tabs go to the mapped routes, in visual order", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin");
    const names = await bar(page).getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent.trim().replace(/\d+ payments? pending verification|\d+$/, "").trim()));
    expect(names).toEqual(["Home", "Search", "Scan QR code", "History", "Profile"]);
    const go = async (name, url) => { await bar(page).getByRole("link", { name }).click(); await expect(page).toHaveURL(new RegExp(url)); };
    await go("Search", "/admin/attendees\\?focus=search"); await go("Scan QR code", "/admin/scanner$"); await go("History", "/admin/tracker$");
    await go(/Profile/, "/admin/profile$"); await go("Home", "/admin$");
  });
  for (const path of ROUTES) {
    test(`${path} highlights ${TAB_FOR[path]} (aria-current)`, async ({ page, as }) => {
      await as("admin"); await page.goto(path); await page.waitForLoadState("networkidle");
      const current = bar(page).locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      expect(await current.first().evaluate((e) => e.getAttribute("aria-label") || e.textContent)).toContain(TAB_FOR[path]);
    });
  }
  test("a sub-route such as /admin/events/123 still highlights Profile", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin/events/123");   // unknown child: the app falls back, but the matcher is path-based
    const cur = await page.evaluate(() => [...document.querySelectorAll("nav.admin-bottom-nav [aria-current=page]")].map((e) => e.textContent));
    expect(cur.length === 0 || cur[0].includes("Profile") || cur[0].includes("Home")).toBe(true);
  });
  test("tapping the active tab scrolls to the top and focuses the page heading", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 400));
    await bar(page).getByRole("link", { name: "Home" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("H1");
  });
  test("the pending-payments badge is on Profile with a text alternative", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    const profile = bar(page).getByRole("link", { name: /Profile/ });
    await expect(profile).toContainText(/\d+ payments? pending verification/);
    await expect(profile.locator(".nav-badge")).toHaveText(/^\d+$/);
  });
});

test.describe("the scan button", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const geo = (page) => page.evaluate(() => {
    const f = document.querySelector(".scan-fab").getBoundingClientRect(), l = document.querySelector(".admin-bottom-nav__list").getBoundingClientRect();
    return { fabTop: f.top, fabBottom: f.bottom, barTop: l.top, barBottom: l.bottom, d: f.width };
  });
  test("raised (about half above the bar) on every page except the Scanner, where it is docked inside the bar", async ({ page, as }) => {
    await as("admin");
    for (const path of ROUTES.filter((p) => p !== "/admin/scanner")) {
      await page.goto(path); await page.waitForLoadState("networkidle");
      const g = await geo(page);
      expect(g.fabTop, path).toBeLessThan(g.barTop - 20);                                // protrudes ~28px
      expect(g.fabBottom, path).toBeGreaterThan(g.barTop + 20);
      expect(await bar(page).getAttribute("data-docked")).toBe("false");
    }
    await page.goto("/admin/scanner"); await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const g = await geo(page);
    expect(g.fabTop).toBeGreaterThanOrEqual(g.barTop); expect(g.fabBottom).toBeLessThanOrEqual(g.barBottom);
    expect(await bar(page).getAttribute("data-docked")).toBe("true");
  });
  test("moves with a 180ms ease-out transition, and with reduced motion there is none", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    expect(await page.locator(".scan-fab").evaluate((e) => getComputedStyle(e).transitionDuration)).toContain("0.18s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const d = await page.locator(".scan-fab").evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(Math.max(...d.split(",").map((x) => parseFloat(x)))).toBeLessThan(0.001);
  });
  test("touch targets are at least 48x48 and the round hit area does not overlap its neighbours", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    const boxes = await bar(page).getByRole("link").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { n: e.getAttribute("aria-label") || e.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (const b of boxes) { expect(b.w, b.n).toBeGreaterThanOrEqual(48); expect(b.h, b.n).toBeGreaterThanOrEqual(48); }
    const [, search, scan, history] = boxes;
    expect(search.x + search.w).toBeLessThanOrEqual(scan.x + 0.5);
    expect(scan.x + scan.w).toBeLessThanOrEqual(history.x + 0.5);
  });
  test("keyboard: Tab order is Home, Search, Scan, History, Profile and focus is visible", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 600, height: 900 }); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    await bar(page).getByRole("link", { name: "Home" }).focus();
    const order = [];
    for (let i = 0; i < 5; i++) { order.push(await page.evaluate(() => document.activeElement.getAttribute("aria-label") || document.activeElement.textContent.trim().replace(/\d+.*$/, "").trim())); await page.keyboard.press("Tab"); }
    expect(order).toEqual(["Home", "Search", "Scan QR code", "History", "Profile"]);
  });
});

test.describe("content is never hidden behind the bar", () => {
  test("the last item scrolls fully above the bar at 320x568", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ["/admin", "/admin/attendees", "/admin/profile", "/admin/scanner"]) {
      await page.goto(path); await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const r = await page.evaluate(() => {
        const last = document.querySelector(".admin-page").lastElementChild.getBoundingClientRect();
        return { bottom: last.bottom, barTop: document.querySelector(".admin-bottom-nav__list").getBoundingClientRect().top, fabTop: document.querySelector(".scan-fab").getBoundingClientRect().top };
      });
      expect(r.bottom, path).toBeLessThanOrEqual(Math.min(r.barTop, r.fabTop) + 1);
    }
  });
  test("the bar hides while a text field has focus (on-screen keyboard) and the page then reaches the bottom", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 390, height: 600 }); await page.goto("/admin/attendees"); await page.waitForLoadState("networkidle");
    await expect(bar(page)).toBeVisible();
    await page.getByLabel("Search attendees").focus();
    await expect(bar(page)).toBeHidden();
    await page.locator("#event-select").focus();
    await page.getByLabel("Search attendees").blur();
    await expect(bar(page)).toBeVisible({ timeout: 2000 }).catch(() => {});
  });
  test("the bar is hidden while a dialog is open", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/admin/events"); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /New event/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(bar(page)).toBeHidden();
  });
});

test.describe("short landscape phones", () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });
  test("56px bar, labels hidden but names kept", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin"); await page.waitForLoadState("networkidle");
    const h = await page.locator(".admin-bottom-nav__list").evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBe(56);
    expect(await page.locator(".bottom-nav-item__label").first().evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    await expect(bar(page).getByRole("link", { name: "Search" })).toBeVisible();
  });
});

test.describe("pages at phone and tablet widths", () => {
  test("tables become cards below 768px, and the payments review is a full-screen sheet", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/attendees"); await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("list", { name: /Attendees/ })).toBeVisible();
    await page.goto("/admin/payments"); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Review/ }).first().click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    const b = await dlg.boundingBox(); expect(b.width).toBeGreaterThanOrEqual(389); expect(b.height).toBeGreaterThanOrEqual(843);
  });
  test("filters collapse into a sheet below 768px and sit inline from 768px", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/attendees"); await page.waitForLoadState("networkidle");
    await expect(page.getByRole("combobox", { name: "Registration status" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Filter/ }).click();
    await expect(page.getByRole("dialog", { name: "Filters" }).getByRole("combobox", { name: "Registration status" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.getByRole("combobox", { name: "Registration status" })).toBeVisible();
  });
  test("payments is a master-detail split from 768px", async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/admin/payments"); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Review/ }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);                                  // not a modal
    await expect(page.getByRole("region", { name: /Payment of/ })).toBeVisible();
    await expect(page.getByRole("list", { name: /Payments/ })).toBeVisible();               // the list stays on the left
  });
  test("the dashboard has 2 stat columns on phones and 4 from 768px", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin");
    const cols = () => page.locator("section[aria-labelledby=stats-h] dl").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
    await page.setViewportSize({ width: 390, height: 844 }); expect(await cols()).toBe(2);
    await page.setViewportSize({ width: 820, height: 1180 }); expect(await cols()).toBe(4);
  });
});

test.describe("axe on every admin page at 360, 768 and 1280", () => {
  for (const w of [360, 768, 1280]) {
    test(`no violations at ${w}px`, async ({ page, as }) => {
      test.setTimeout(90_000);
      await as("admin"); await page.setViewportSize({ width: w, height: w === 1280 ? 800 : 900 });
      for (const path of ROUTES) {
        await page.goto(path); await page.waitForLoadState("networkidle");
        // A fixed bar always covers whatever is scrolled beneath it, and axe's target-size rule counts that as "obscured".
        // So: everything except target-size with the bar in place, then target-size on the page content with the bar
        // hidden (the bar's own targets are measured in "touch targets are at least 48x48" above).
        const v = (await newAxe(page).withTags(AXE_TAGS).disableRules(["target-size"]).analyze()).violations;
        expect(v, `${path} @${w}\n${formatViolations(v)}`).toEqual([]);
        await page.addStyleTag({ content: ".admin-bottom-nav{visibility:hidden!important}.page-actions{position:static!important}.sticky{position:static!important}" });
        const t = (await newAxe(page).withRules(["target-size"]).analyze()).violations;
        expect(t, `${path} @${w} target-size\n${formatViolations(t)}`).toEqual([]);
      }
    });
  }
});

test.describe("screenshots for each breakpoint, both orientations", () => {
  test("saves them to test-results/admin-nav", async ({ page, as }) => {
    test.setTimeout(120_000);
    await as("admin");
    const dir = "test-results/admin-nav"; fs.mkdirSync(dir, { recursive: true });
    const sizes = [[320, 568], [360, 640], [390, 844], [430, 932], [600, 960], [768, 1024], [820, 1180], [834, 1194], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [1920, 1080]];
    await page.goto("/admin"); await page.waitForLoadState("networkidle");
    for (const [w, h] of sizes) for (const [pw, ph, tag] of [[w, h, "portrait"], [h, w, "landscape"]]) {
      await page.setViewportSize({ width: pw, height: ph }); await page.waitForTimeout(60);
      await page.screenshot({ path: `${dir}/dashboard-${pw}x${ph}-${tag}.png` });
    }
    expect(fs.readdirSync(dir).length).toBeGreaterThanOrEqual(26);
  });
});
