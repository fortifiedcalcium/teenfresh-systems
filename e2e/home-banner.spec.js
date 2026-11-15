import sharp from "sharp";
import { test, expect } from "./fixtures.js";

const settle = async (page) => { await page.waitForLoadState("networkidle"); await page.locator("html[data-hydrated]").waitFor({ state: "attached" }); };
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("home banner", () => {
  for (const [w, h] of [[360, 740], [768, 900], [1024, 800], [1440, 900], [1920, 1080]]) {
    test(`${w}px: scales with no sideways scroll; text and ticket ${w >= 1024 ? "side by side" : "stacked"}`, async ({ page, as }) => {
      await as(null);
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await settle(page);
      expect(await noSideScroll(page)).toBe(true);
      const hero = page.locator(".home-hero");
      const text = await hero.getByRole("heading", { level: 1 }).boundingBox();
      const ticket = await hero.locator("#featured-event").boundingBox();
      const box = await hero.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(w);
      if (w >= 1024) expect(ticket.x).toBeGreaterThan(text.x + text.width * 0.5); else expect(ticket.y).toBeGreaterThan(text.y + text.height);
    });
  }
  test("the banner picture sits behind a semi-transparent overlay and has its alt text; the headline stays readable", async ({ page, as }) => {
    await as(null);
    await page.goto("/");
    await settle(page);
    const img = page.locator(".home-hero__bg");
    await expect(img).toHaveAttribute("alt", "A crowd at the show");
    const overlay = page.locator(".home-hero__overlay");
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    const alpha = await overlay.evaluate((el) => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); return m.length > 3 ? Number(m[3]) : 1; });
    expect(alpha).toBeGreaterThan(0.5); expect(alpha).toBeLessThan(1);                  // a veil, not a wall
    const z = await page.evaluate(() => { const g = (q) => Number(getComputedStyle(document.querySelector(q)).zIndex); return { img: g(".home-hero__bg"), overlay: g(".home-hero__overlay") }; });
    expect(z.overlay).toBeGreaterThan(z.img);
  });
});

test("admin: add a banner picture with alt text, pick the featured event, and save", async ({ page, as }) => {
  await as("admin");
  const saved = [];
  page.on("request", (r) => { if (r.url().includes("/rest/v1/home_settings") && r.method() === "PATCH") saved.push(r.postDataJSON()); });
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home page" })).toBeVisible();
  await expect(page.getByLabel(/Describe the picture/)).toHaveValue("A crowd at the show");
  await page.getByLabel(/Describe the picture/).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".alert-bad", { hasText: "Describe the picture" })).toBeVisible();     // alt text is required unless decorative
  await page.getByLabel(/Decorative/).check();
  await page.getByLabel("Event shown in the banner").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Home page saved")).toBeVisible();
  expect(saved.at(-1)).toMatchObject({ banner_path: "home/banner.jpg", banner_decorative: true });
  expect(saved.at(-1).featured_event_id).toBeTruthy();
});

test("admin: a file that is not a JPG, PNG or WebP is refused before upload", async ({ page, as }) => {
  await as("admin");
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home page" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.locator(".alert-bad", { hasText: "JPG, PNG or WebP" })).toBeVisible();
});

test("admin: the banner headline and description are saved", async ({ page, as }) => {
  await as("admin");
  const saved = [];
  page.on("request", (r) => { if (r.url().includes("/rest/v1/home_settings") && r.method() === "PATCH") saved.push(r.postDataJSON()); });
  await page.goto("/admin/home");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Headline \(the event name\)/).fill("Fan meet night");
  await page.getByLabel(/Description under the headline/).fill("Come hang out with us.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Home page saved")).toBeVisible();
  expect(saved.at(-1)).toMatchObject({ hero_headline: "Fan meet night", hero_description: "Come hang out with us." });
});

test("admin: a big photo is shrunk to a smaller WebP before it is uploaded", async ({ page, as }) => {
  await as("admin");
  // a 3600 x 2400 photo full of noise: several MB as a JPEG
  const big = await sharp({ create: { width: 3600, height: 2400, channels: 3, background: "#888", noise: { type: "gaussian", mean: 128, sigma: 40 } } }).jpeg({ quality: 90 }).toBuffer();
  expect(big.length).toBeGreaterThan(2 * 1024 * 1024);
  let upload = null;
  page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/storage/v1/object/event-media/home/")) upload = r.postDataBuffer(); });
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home page" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles({ name: "crowd.jpg", mimeType: "image/jpeg", buffer: big });
  await page.getByLabel(/Describe the picture/).fill("A crowd");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Home page saved")).toBeVisible();
  expect(upload).not.toBeNull();
  expect(upload.length).toBeLessThan(big.length * 0.6);                           // clearly smaller than what the admin chose
  expect(upload.includes(Buffer.from("WEBP"))).toBe(true);                          // and saved as WebP
  expect(upload.includes(Buffer.from("image/webp"))).toBe(true);
});

test("admin: a picture that is still too big after shrinking is refused and nothing is uploaded", async ({ page, as }) => {
  await as("admin");
  // incompressible noise saved as a PNG stays far over 1.5 MB even when scaled to 1920 px wide
  const big = await sharp({ create: { width: 1920, height: 1280, channels: 3, background: "#888", noise: { type: "gaussian", mean: 128, sigma: 80 } } }).png({ compressionLevel: 0 }).toBuffer();
  let uploaded = false;
  page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/storage/v1/object/event-media/home/")) uploaded = true; });
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home page" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles({ name: "noise.png", mimeType: "image/png", buffer: big });
  await page.getByLabel(/Describe the picture/).fill("Noise");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".alert-bad", { hasText: "the most allowed is 1.5 MB" })).toBeVisible();
  expect(uploaded).toBe(false);
});
