import { test, expect, fontsReady } from "./fixtures.js";

// The facts on an event ticket: a compact two-column grid (Date, Time, Fee or Kits, Slots left), each label above its value, rows lined up,
// nothing overflowing sideways, and the barcode strip above the Register button.
for (const width of [320, 360, 390, 768, 1024, 1280]) {
  test(`event ticket facts are in a tidy two-column grid at ${width}px`, async ({ page, as }) => {
    await page.setViewportSize({ width, height: 900 });
    await as(null);
    await page.goto("/");
    const card = page.locator("article").first();                                 // the featured event, in the hero
    await expect(card.locator(".event-facts")).toBeVisible();
    const labels = await card.locator(".event-facts dt").allTextContents();
    expect(labels).toEqual(["Date", "Time", "Kits", "Slots left"]);               // this event has kits, so Fee reads Kits
    const cells = await card.locator(".event-facts > div").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }));
    expect(cells[0].y, "Date and Time share a row").toBe(cells[1].y);
    expect(cells[2].y, "Kits and Slots left share a row").toBe(cells[3].y);
    expect(cells[1].x, "two columns").toBeGreaterThan(cells[0].x);
    expect(cells[2].y, "the second row is below the first").toBeGreaterThan(cells[0].y);
    await expect(card.locator(".event-facts").getByText("₱100.00 to ₱250.50 each")).toBeVisible();
    await expect(card.locator(".event-facts__note")).toHaveText("(exclusive of food and drinks)");
    const bar = await card.locator("svg.ticket__barcode").boundingBox();
    const button = await card.getByRole("link", { name: /Register for/ }).boundingBox();
    expect(bar.y + bar.height, "the barcode strip is above the Register button").toBeLessThanOrEqual(button.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);   // no sideways scroll
    expect(await card.evaluate((c) => c.scrollWidth <= c.clientWidth + 1)).toBe(true);
  });
}

test.describe("visual snapshots", () => {
  for (const width of [360, 1024]) {
    test(`event card at ${width}px`, async ({ page, as }) => {
      await page.setViewportSize({ width, height: 900 });
      await as(null);
      await page.goto("/");
      const card = page.locator("article").first();
      await expect(card.locator(".event-facts")).toBeVisible();
      await page.evaluate(() => { document.querySelectorAll("header.sticky").forEach((h) => { h.style.position = "static"; }); document.querySelectorAll(".public-bottom-nav").forEach((n) => { n.style.display = "none"; }); });   // the sticky header must not cover the part being photographed
      await fontsReady(page);
      await expect(card).toHaveScreenshot(`event-card-${width}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }
});
