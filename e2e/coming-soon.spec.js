import { test, expect } from "./fixtures.js";

test("a banner switched to Coming soon shows the panel on the event card, at the same size as the other cards", async ({ page, as }) => {
  await as(null);
  await page.goto("/");
  const soon = page.locator("[data-coming-soon]");
  await expect(soon).toHaveCount(1);
  await expect(soon).toContainText("Coming soon");
  const cards = page.locator("article");
  const heights = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);                                          // equal-size cards
  await page.screenshot({ path: "test-results/coming-soon/home.png", fullPage: true });
});
