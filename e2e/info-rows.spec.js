import { test, expect } from "./fixtures.js";

// The event facts on the card: icon and label line up with the FIRST line of the text, rows are 12 px apart,
// nothing overflows sideways, and the Kits note sits on its own line.
for (const width of [320, 360, 390, 768, 1024, 1280]) {
  test(`event card rows are aligned and evenly spaced at ${width}px`, async ({ page, as }) => {
    await page.setViewportSize({ width, height: 900 });
    await as(null);
    await page.goto("/");
    const card = page.locator("article").first();
    await expect(card.locator(".info-row").first()).toBeVisible();
    const rows = await card.locator(".info-row").evaluateAll((els) => els.map((li) => {
      const icon = li.querySelector(".info-icon").getBoundingClientRect();
      const p = li.querySelector(".info-text"), pr = p.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(p).lineHeight);
      return { label: li.querySelector("strong").textContent, iconMid: icon.top + icon.height / 2, firstLineMid: pr.top + lh / 2, top: li.getBoundingClientRect().top, bottom: li.getBoundingClientRect().bottom, lines: Math.round(pr.height / lh) };
    }));
    for (const r of rows) expect(Math.abs(r.iconMid - r.firstLineMid), `${r.label} icon is on the first line`).toBeLessThanOrEqual(1.5);
    for (let i = 1; i < rows.length; i++) expect(Math.round(rows[i].top - rows[i - 1].bottom), "12 px between rows").toBe(12);
    const kits = card.locator(".info-row", { hasText: "Kits:" });
    await expect(kits.locator(".info-text")).toContainText("₱100.00 to ₱250.50 each");
    const note = kits.locator(".info-note");
    await expect(note).toHaveText("(exclusive of food and drinks)");
    const [nb, tb] = await Promise.all([note.boundingBox(), kits.locator("strong").boundingBox()]);
    expect(nb.y).toBeGreaterThan(tb.y + tb.height - 2);                                      // the note is on its own line, below the label line
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
      await expect(card.locator(".info-row").first()).toBeVisible();
      await expect(card).toHaveScreenshot(`event-card-${width}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }
});
