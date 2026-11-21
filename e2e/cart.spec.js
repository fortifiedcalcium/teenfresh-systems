import { test, expect, scan, formatViolations } from "./fixtures.js";

// The cart (a ticket stub) and the checkout summary, with two ÖRBITAL (Version A) in the cart.
// Each account has its own saved cart ("teenfresh-cart:<user id>"); visitors who are signed out share "teenfresh-cart:guest". The test user is u1.
const withCart = async (page, who = "guest") => page.addInitScript((key) => { try { localStorage.setItem(key, JSON.stringify([{ id: "pa", vid: "va", qty: 2 }])); } catch { /* no storage */ } }, `teenfresh-cart:${who}`);

for (const width of [360, 1280]) {
  test(`cart at ${width}px: lines, total, change the quantity, no sideways scroll, axe clean`, async ({ page, as }) => {
    await as(null); await withCart(page); await page.setViewportSize({ width, height: 900 });
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ÖRBITAL" })).toBeVisible();
    await expect(page.getByText("Version: Version A")).toBeVisible();
    await expect(page.locator("section[aria-label='Your cart']")).toContainText("₱1,500.00");   // 2 x 750 (the price already includes the discount)
    await page.getByLabel("Quantity of ÖRBITAL, Version A").selectOption("3");
    await expect(page.locator("section[aria-label='Your cart']")).toContainText("₱2,250.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.waitForLoadState("networkidle");
    const v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
  });
}

test("checkout: summary of the order, GCash details, and the place-order button", async ({ page, as }) => {
  await as("user"); await withCart(page, "u1");
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  const summary = page.getByLabel("Order summary");
  await expect(summary).toContainText("ÖRBITAL");
  await expect(summary).toContainText("Version: Version A");
  await expect(page.getByText("09171234567").first()).toBeVisible();                 // the GCash number from the shop settings
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
  await page.waitForLoadState("networkidle");
  const v = await scan(page); expect(v, formatViolations(v)).toEqual([]);
});
