import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

// What a search engine or a link preview sees: the HTML the SERVER sends, with no JavaScript run. The server reads the fake Supabase (e2e/fake-supabase.mjs).
const get = (request, path) => request.get(path, { maxRedirects: 0 });

test("home: the events are in the HTML, with its own title and share tags", async ({ request }) => {
  const html = await (await get(request, "/")).text();
  expect(html).toContain("IVEMON: ODD PLATINUM Cupsleeve Event");
  expect(html).toContain("<title>Upcoming events · Teenfresh Events</title>");
  expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="Upcoming events"/);
  expect(html).toMatch(/<link[^>]+rel="canonical"[^>]+href="https:\/\/teenfresh\.pages\.dev\/"/);
  expect(html).toContain("/events/ivemon-odd-platinum");                      // the card links by slug
});

test("event page: the facts and Event JSON-LD are in the HTML; an old id address is a permanent redirect", async ({ request }) => {
  const res = await get(request, "/events/ivemon-odd-platinum");
  const html = await res.text();
  expect(res.status()).toBe(200);
  expect(html).toContain("<title>IVEMON: ODD PLATINUM Cupsleeve Event · Teenfresh Events</title>");
  const ld = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
  expect(ld["@type"]).toBe("Event");
  expect(ld.location.name).toBe("Psicom Blue Club");
  expect(ld.offers.price).toBe("100");
  const old = await get(request, "/events/e1");
  expect(old.status()).toBe(301);
  expect(old.headers().location).toBe("/events/ivemon-odd-platinum");
});

test("shop and product pages: products and Product JSON-LD are in the HTML; an old id address is a permanent redirect", async ({ request }) => {
  const shop = await (await get(request, "/shop")).text();
  for (const name of ["ÖRBITAL", "Light stick", "Photocard set"]) expect(shop).toContain(name);
  expect(shop).toContain("Low stock");
  const res = await get(request, "/shop/orbital");
  const html = await res.text();
  const ld = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers["@type"]).toBe("AggregateOffer");
  expect(ld.offers.lowPrice).toBe("750");
  expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="ÖRBITAL \(Marv\)"/);
  const old = await get(request, "/shop/pa");
  expect(old.status()).toBe(301);
  expect(old.headers().location).toBe("/shop/orbital");
});

test("an event or product that does not exist is a real 404 (with the friendly page)", async ({ request }) => {
  for (const path of ["/events/nope", "/shop/nope"]) { const res = await get(request, path); expect(res.status(), path).toBe(404); expect(await res.text()).toContain("not "); }
});

test("sitemap.xml lists the pages by slug, and robots.txt points to it and hides the private areas", async ({ request }) => {
  const sitemap = await (await get(request, "/sitemap.xml")).text();
  for (const loc of ["https://teenfresh.pages.dev/", "https://teenfresh.pages.dev/shop", "https://teenfresh.pages.dev/events/ivemon-odd-platinum", "https://teenfresh.pages.dev/shop/orbital"]) expect(sitemap).toContain(`<loc>${loc}</loc>`);
  const robots = await (await get(request, "/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://teenfresh.pages.dev/sitemap.xml");
  expect(robots).toContain("Disallow: /admin");
});

test("account and admin pages are drawn in the browser, not rendered with anyone's data", async ({ request }) => {
  const html = await (await get(request, "/admin")).text();
  expect(html).not.toContain("IVEMON: ODD PLATINUM");
  expect((await get(request, "/login")).status()).toBe(200);
});

test("the CSP allows exactly the inline scripts the page has (by hash), and no 'unsafe-inline' for scripts", async ({ request }) => {
  const res = await get(request, "/shop/orbital");
  const html = await res.text();
  const csp = res.headers()["content-security-policy"];
  expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/json|application\/ld\+json|importmap|speculationrules)")[^>]*>([\s\S]*?)<\/script>/g)].filter((m) => m[1].trim());
  expect(inline.length).toBeGreaterThan(0);
  for (const m of inline) expect(csp, "an inline script without a hash").toContain(`'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
});
