import { test, expect } from "./fixtures.js";

// The shop and the event page: readable addresses, the small status badge on each card, From prices, SEO tags.
test("shop cards: badges, price range, and links by slug", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  const card = (name) => page.locator("article.pcard", { hasText: name });
  await expect(card("ÖRBITAL")).toContainText("New");
  await expect(card("ÖRBITAL")).toContainText(/₱\s?750(\.00)?\s*–\s*₱\s?900/);   // from the lowest to the highest version
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
  await expect(row).toContainText("3 variations");                    // loaded from product_variations (this page stayed on "Loading products…" when that call failed)
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

// Stock, the price shown and the pre-order period
test("price: a range from the lowest to the highest version still in stock (the cheaper Version C is sold out)", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  await expect(page.locator("article.pcard", { hasText: "ÖRBITAL" })).toContainText(/₱\s?750(\.00)?\s*–\s*₱\s?900/);
  await page.goto("/shop/orbital");
  await expect(page.locator(".pd-price")).toContainText(/₱\s?750(\.00)?\s*–\s*₱\s?900/);
  await expect(page.locator(".pd-price")).not.toContainText(/₱\s?600/);       // the sold-out version is not in the range
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerHTML());
  expect(ld.offers.lowPrice).toBe("750");
  expect(ld.offers.highPrice).toBe("900");
  expect(ld.offers.availability).toBe("https://schema.org/InStock");
});

test("a product with no versions and a stock of 0 is Sold out: badge, and Add to cart is switched off", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  await expect(page.locator("article.pcard", { hasText: "Plain sold out" })).toContainText("Sold out");
  await page.goto("/shop/plain-sold-out");
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Buy now" })).toBeDisabled();
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerHTML());
  expect(ld.offers.availability).toBe("https://schema.org/SoldOut");
});

test("an ended pre-order: a label on the thumbnail instead of the Pre-order badge, and Add to cart is switched off", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop");
  const card = page.locator("article.pcard", { hasText: "Ended pre-order" });
  await expect(card.locator(".pcard__notice")).toHaveText("Pre-order period ended");
  await expect(card.locator(".pcard__photo").getByText("Pre-order", { exact: true })).toHaveCount(0);
  await expect(page.locator("article.pcard", { hasText: "Season's greetings" }).locator(".pcard__notice")).toHaveCount(0);   // an open pre-order has none
  await page.goto("/shop/ended-preorder");
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Buy now" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Pre-order period ended" })).toBeVisible();
});

test("an open pre-order can still be added to the cart", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop/season-greetings");
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
});

test("quantity is locked until a version is picked, and free for a product with no versions", async ({ page, as }) => {
  await as(null);
  await page.goto("/shop/orbital");
  await page.waitForLoadState("networkidle");
  const plus = page.getByRole("button", { name: "Increase quantity" }), minus = page.getByRole("button", { name: "Decrease quantity" });
  await expect(plus).toBeDisabled();
  await expect(minus).toBeDisabled();
  await expect(page.getByText("Choose a version above to set the quantity.")).toBeVisible();
  await page.getByRole("radio", { name: /Version A/ }).check();
  await expect(plus).toBeEnabled();
  await plus.click();
  await expect(page.getByRole("status", { name: "Quantity" }).or(page.locator("output"))).toHaveText("2");
  await page.getByRole("radio", { name: /Version B/ }).check();                      // a new pick starts again at 1
  await expect(page.locator("output")).toHaveText("1");
  await page.goto("/shop/photocard-set");                                             // a product with no versions: nothing is locked
  await page.goto("/shop/season-greetings");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Increase quantity" })).toBeEnabled();
  await expect(page.getByText("to set the quantity")).toHaveCount(0);
});
