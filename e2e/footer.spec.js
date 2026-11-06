import { test, expect } from "./fixtures.js";

test.describe("footer", () => {
  test("four clickable social icons, then @teenfreshph once; 44 px targets, new tab, named for screen readers", async ({ page, as }) => {
    await as(null);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Social media" });
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(5);                                                       // 4 icons + the handle
    const hrefs = { Facebook: "facebook.com/TeenfreshPH", X: "x.com/TeenfreshPH", Instagram: "instagram.com/teenfreshph", TikTok: "tiktok.com/@teenfreshph" };
    let prev = -1;
    for (const [name, href] of Object.entries(hrefs)) {                                       // order: Facebook, X, Instagram, TikTok
      const l = nav.getByRole("link", { name, exact: true });
      await expect(l).toHaveAttribute("href", new RegExp(href.replace(/[.$]/g, "\\$&")));
      await expect(l).toHaveAttribute("target", "_blank");
      await expect(l).toHaveAttribute("rel", /noopener/);
      await expect(l.locator("svg")).toHaveAttribute("aria-hidden", "true");
      const box = await l.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThan(prev); prev = box.x;
    }
    const handle = nav.getByRole("link", { name: "@teenfreshph" });
    await expect(handle).toHaveCount(1);
    expect((await handle.boundingBox()).x).toBeGreaterThan(prev);                              // the handle sits to the right of the icons
    await expect(page.getByRole("contentinfo").getByText("TeenfreshPH", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Report an accessibility issue" })).toBeVisible();
  });

  test("icons are 40 px wide on desktop and 28 px under 480 px, and the row has no horizontal scroll", async ({ page, as }) => {
    await as(null);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const svg = page.getByRole("navigation", { name: "Social media" }).getByRole("link", { name: "Facebook" }).locator("svg");
    expect((await svg.boundingBox()).width).toBe(40);
    await page.setViewportSize({ width: 360, height: 800 });
    expect((await svg.boundingBox()).width).toBe(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
