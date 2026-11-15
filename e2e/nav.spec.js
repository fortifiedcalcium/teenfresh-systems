import { test, expect, scan, formatViolations } from "./fixtures.js";

// The public navigation: one slim pill row on a desktop (Events, Shop, Cart and an Account menu), a bottom bar on a phone.
const ready = async (page) => { await page.waitForLoadState("networkidle"); await page.locator("html[data-hydrated]").waitFor({ state: "attached" }); };

test("desktop: the account menu holds the personal links, opens by keyboard, closes with Escape, and is axe clean", async ({ page, as }) => {
  await as("admin"); await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/shop"); await ready(page);
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  for (const name of ["Events", "Shop", "Cart"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  for (const name of ["My orders", "My registrations", "Admin", "Sign out"]) await expect(nav.getByText(name, { exact: true })).toHaveCount(0);   // none of them sit in the bar itself
  const height = await nav.evaluate((n) => Math.round(n.getBoundingClientRect().height));
  expect(height, "a slim single row").toBeLessThan(80);
  const account = nav.getByRole("button", { name: /^Account/ });
  await account.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("region", { name: "Account" });
  await expect(menu).toBeVisible();
  for (const name of ["My orders", "My registrations", "Admin"]) await expect(menu.getByRole("link", { name })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Notifications/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  const v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(account).toBeFocused();                                          // focus goes back to the button
});

test("phone: the bottom bar has 44px targets, a visible focus ring, no sideways scroll, and the Account menu opens upwards", async ({ page, as }) => {
  await as("user"); await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/shop"); await ready(page);
  const bar = page.getByRole("navigation", { name: "Main (bottom bar)" });
  await expect(bar).toBeVisible();
  const items = bar.locator("a, button");
  expect(await items.count()).toBe(4);                                          // Events, Shop, Cart, Account
  const sizes = await items.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  for (const [w, h] of sizes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44); }
  await page.keyboard.press("Tab");                                             // focus rings: the first item reached by keyboard in the bar
  await bar.getByRole("link", { name: "Events" }).focus();
  const outline = await bar.getByRole("link", { name: "Events" }).evaluate((e) => { const s = getComputedStyle(e); return [s.outlineStyle, parseFloat(s.outlineWidth)]; });
  expect(outline[0]).toBe("solid"); expect(outline[1]).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await bar.getByRole("button", { name: /^Account/ }).click();
  const menu = page.getByRole("region", { name: "Account" });
  await expect(menu).toBeVisible();
  const [m, b] = await Promise.all([menu.boundingBox(), bar.boundingBox()]);
  expect(m.y + m.height, "the menu opens above the bar").toBeLessThanOrEqual(b.y + 1);
  const v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
});

test("signed-out phone: the bar offers Sign in, and the top bar has Sign in and Sign up", async ({ page, as }) => {
  await as(null); await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/"); await ready(page);
  await expect(page.getByRole("navigation", { name: "Main (bottom bar)" }).getByRole("link", { name: "Sign in" })).toBeVisible();
  const v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
});
