import { test, expect, fontsReady } from "./fixtures.js";

// The event cards below the home hero (Keepsake look): the poster fills the top of the card edge to edge in a 4:5 frame, the facts are stickers
// (date, time, price, slots), the button is the last thing, and nothing overflows sideways.
for (const width of [320, 360, 390, 768, 1024, 1280]) {
  test(`event cards: poster fills the top, facts are stickers, nothing overflows at ${width}px`, async ({ page, as }) => {
    await page.setViewportSize({ width, height: 900 });
    await as(null);
    await page.goto("/");
    const cards = page.locator("#events article");
    await expect(cards).toHaveCount(2);                                            // a sold-out event and a closed one (both still upcoming)
    for (let i = 0; i < 2; i++) {
      const card = cards.nth(i);
      const box = await card.boundingBox();
      const media = await card.locator(".kcard__media").boundingBox();
      expect(Math.abs(media.width - box.width), "the poster spans the card").toBeLessThanOrEqual(2);
      expect(Math.abs(media.y - box.y), "the poster starts at the card's top edge").toBeLessThanOrEqual(2);
      expect(Math.abs(media.height / media.width - 1.25), "the frame is 4:5").toBeLessThan(0.02);
      const stickers = card.locator(".sticker");
      expect(await stickers.count(), "date, time, price and slots").toBeGreaterThanOrEqual(3);
      const last = await stickers.last().boundingBox();
      const button = await card.getByRole("link", { name: /View event|Register for/ }).boundingBox();
      expect(last.y + last.height, "the button is below the facts").toBeLessThanOrEqual(button.y + 1);
      expect(await card.evaluate((c) => c.scrollWidth <= c.clientWidth + 1), "nothing sticks out of the card").toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);   // no sideways scroll
    // the fee note sits after the price
    await expect(cards.filter({ hasText: "A closed event" }).locator(".sticker__note")).toHaveText("(exclusive of food and drinks)");
  });
}

test("the hero shows the event's facts as stickers, with the kit prices and the countdown", async ({ page, as }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await as(null);
  await page.goto("/");
  const facts = page.locator(".hero2__stickers");
  await expect(facts.getByText("₱100.00 to ₱250.50 each")).toBeVisible();          // this event has kits, so the price reads as a range
  await expect(page.locator(".hero2").getByRole("group", { name: "Countdown to the event" })).toBeVisible();
});

test.describe("visual snapshots", () => {
  for (const width of [360, 1024]) {
    test(`event card at ${width}px`, async ({ page, as }) => {
      await page.setViewportSize({ width, height: 900 });
      await as(null);
      await page.goto("/");
      const card = page.locator("#events article").last();                         // the closed event: poster, price with its note, closed status
      await expect(card.locator(".sticker").first()).toBeVisible();
      await page.evaluate(() => { document.querySelectorAll("header.sticky").forEach((h) => { h.style.position = "static"; }); document.querySelectorAll(".public-bottom-nav").forEach((n) => { n.style.display = "none"; }); });   // the sticky header must not cover the card
      await fontsReady(page);
      await expect(card).toHaveScreenshot(`event-card-${width}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }
});
