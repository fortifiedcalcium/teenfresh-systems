import { test, expect } from "./fixtures.js";

// select all the text of the first block with text in the editor (key shortcuts for "select line" differ between macOS and Linux)
const selectFirstBlock = (box) => box.evaluate((el) => {
  const node = el.querySelector("li") || [...el.children].find((c) => c.textContent) || el, r = document.createRange();
  r.selectNodeContents(node);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});

test("Terms visual editor: bold, numbered list and link work in a real browser", async ({ page, as }) => {
  await as("admin");
  await page.goto("/admin/events");
  await page.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }).click();
  const box = page.getByRole("textbox", { name: "Terms and Conditions" });
  await box.scrollIntoViewIfNeeded();
  await expect(box).toContainText("Please read these Terms");

  await box.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Rule one");
  await selectFirstBlock(box);
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(box.locator("strong, b")).toHaveText("Rule one");
  await page.getByRole("button", { name: "Numbered list" }).click();
  await expect(box.locator("ol li")).toHaveCount(1);

  await selectFirstBlock(box);
  await page.getByRole("button", { name: "Link" }).click();
  await page.getByLabel("Link address").fill("fb.com/TeenfreshPH");
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(box.locator('a[href="https://fb.com/TeenfreshPH"]')).toHaveText("Rule one");
  await expect(box.locator("script, [onclick]")).toHaveCount(0);
});
