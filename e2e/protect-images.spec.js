import { test, expect } from "./fixtures.js";

// Visitors cannot right-click or drag to save the pictures on the public pages, but they can still save the GCash QR code and use keyboards freely.
const settle = async (page) => { await page.waitForLoadState("networkidle"); await page.locator("html[data-hydrated]").waitFor({ state: "attached" }); };
// fires the event and reports whether the page cancelled it (that is what stops the browser's menu or drag)
const cancelled = (page, selector, type) => page.evaluate(([s, t]) => { const el = document.querySelector(s); const ev = new Event(t, { bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; }, [selector, type]);

test("pictures on the public pages cannot be saved with the menu or dragged away", async ({ page, as }) => {
  await as(null);
  await page.goto("/");
  await settle(page);
  const sel = ".home-hero__bg";
  await expect(page.locator(sel)).toHaveCount(1);
  expect(await cancelled(page, sel, "contextmenu")).toBe(true);
  expect(await cancelled(page, sel, "dragstart")).toBe(true);
  expect(await page.locator(sel).evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
});

test("text and links still get the normal menu, and an image marked data-allow-save can be saved", async ({ page, as }) => {
  await as(null);
  await page.goto("/");
  await settle(page);
  expect(await cancelled(page, "h1", "contextmenu")).toBe(false);
  await page.evaluate(() => { const i = document.createElement("img"); i.id = "qr-test"; i.setAttribute("data-allow-save", ""); i.alt = "GCash QR code"; document.querySelector("main").appendChild(i); });
  expect(await cancelled(page, "#qr-test", "contextmenu")).toBe(false);
  expect(await cancelled(page, "#qr-test", "dragstart")).toBe(false);
});

test("the admin area is left alone", async ({ page, as }) => {
  await as("admin");
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home page" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => { const i = document.createElement("img"); i.id = "admin-img"; i.alt = ""; document.querySelector("main").appendChild(i); });
  expect(await cancelled(page, "#admin-img", "contextmenu")).toBe(false);
});
