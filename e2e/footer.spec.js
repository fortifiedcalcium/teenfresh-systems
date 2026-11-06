import { test, expect } from "./fixtures.js";

test.describe("footer", () => {
  test("shows the handle once, with clickable Facebook, X and email icons that are 44 px targets", async ({ page, as }) => {
    await as(null);
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText("TeenfreshPH", { exact: true })).toHaveCount(1);          // the name appears once, not as /TeenfreshPH and @TeenfreshPH
    const fb = footer.getByRole("link", { name: "Teenfresh on Facebook" });
    const x = footer.getByRole("link", { name: "Teenfresh on X" });
    const mail = footer.getByRole("link", { name: "Report an accessibility issue" });
    await expect(fb).toHaveAttribute("href", "https://www.facebook.com/TeenfreshPH");
    await expect(x).toHaveAttribute("href", "https://x.com/TeenfreshPH");
    await expect(mail).toBeVisible();
    for (const l of [fb, x, mail]) {
      const box = await l.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(l.locator("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });
});
