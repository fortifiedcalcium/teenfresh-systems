import { test } from "./fixtures.js";
for (const [w, h, path] of [[390, 844, "/admin"], [390, 844, "/admin/scanner"], [768, 1024, "/admin"], [1024, 768, "/admin"], [390, 844, "/admin/profile"]]) {
  test(`shot ${w}x${h} ${path}`, async ({ page, as }) => {
    await as("admin"); await page.setViewportSize({ width: w, height: h }); await page.goto(path); await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `/private/tmp/claude-501/qp/s/${w}-${path.replace(/\//g, "_")}.png` });
  });
}
