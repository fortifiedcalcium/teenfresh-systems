import { test, expect } from "./fixtures.js";

// The shop and the event page: readable addresses, the small status badge on each card, From prices, SEO tags.
test("shop cards: badges, From price, and links by slug", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  const card = (name) => page.locator("article.pcard", { hasText: name });
  await expect(card("ÖRBITAL")).toContainText("New");
  await expect(card("ÖRBITAL")).toContainText("From");                // Version B costs more than the base price
  await expect(card("Light stick")).toContainText("Low stock");       // 3 left
  await expect(card("Photocard set")).toContainText("Sold out");
  await expect(card("Season's greetings")).toContainText("Pre-order");
  await expect(card("ÖRBITAL").getByRole("link", { name: "ÖRBITAL" })).toHaveAttribute("href", "/shop/orbital");
});

test("an old id address moves to the slug, and the product page has its own title, description and Product data", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop/pa");
  await expect(page).toHaveURL(/\/shop\/orbital$/);
  await expect(page.getByRole("heading", { level: 1, name: "ÖRBITAL" })).toBeVisible();
  await expect(page).toHaveTitle("ÖRBITAL (Marv) · Teenfresh Events");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "ÖRBITAL (Marv)");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/shop\/orbital$/);
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerHTML());
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers["@type"]).toBe("AggregateOffer");                  // two versions at two prices
  expect(ld.offers.priceCurrency).toBe("PHP");
});

test("the event page: slug address, Event data, and the old id address and register link still work", async ({ page, as }) => {
  await as("user");
  await page.goto("/events/e1");
  await expect(page).toHaveURL(/\/events\/ivemon-odd-platinum$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("IVEMON: ODD PLATINUM");
  await expect(page).toHaveTitle("IVEMON: ODD PLATINUM Cupsleeve Event · Teenfresh Events");
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerHTML());
  expect(ld["@type"]).toBe("Event");
  expect(ld.offers.price).toBe("100");                                // the cheapest kit
  await page.getByRole("link", { name: "Register for this event" }).click();
  await expect(page).toHaveURL(/\/events\/ivemon-odd-platinum\/register$/);
  await page.goto("/events/e1/register");                             // an old address
  await expect(page).toHaveURL(/\/events\/ivemon-odd-platinum\/register$/);
});

test("admin: the shop products page loads the products and their variations", async ({ page, as }) => {
  await as("admin");
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { level: 1, name: "Shop products" })).toBeVisible();
  const row = page.locator("li.card", { hasText: "ÖRBITAL" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("2 variations");                    // loaded from product_variations (this page stayed on "Loading products…" when that call failed)
  await expect(page.locator("li.card", { hasText: "Photocard set" })).toContainText("Sold out");
});

test("category chips: every category has one (even with a single product or none), filtering works and the count is announced", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  await page.waitForLoadState("networkidle");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });      // the server-rendered page is interactive
  const group = page.getByRole("group", { name: "Filter products" });
  for (const name of ["All", "ALBUM", "MD", "SINGLE", "LIMITED", "Pre-Order"]) await expect(group.getByRole("button", { name, exact: true })).toBeVisible();
  await group.getByRole("button", { name: "SINGLE", exact: true }).click();
  await expect(group.getByRole("button", { name: "SINGLE", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("article.pcard")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "SINGLE: 1 product" })).toHaveCount(1);
  await group.getByRole("button", { name: "ALBUM", exact: true }).click();
  await expect(page.locator("article.pcard")).toHaveCount(2);
  await expect(page.getByRole("status").filter({ hasText: "ALBUM: 2 products" })).toHaveCount(1);
  await group.getByRole("button", { name: "LIMITED", exact: true }).click();
  await expect(page.getByText("No products in LIMITED yet.")).toBeVisible();
});
