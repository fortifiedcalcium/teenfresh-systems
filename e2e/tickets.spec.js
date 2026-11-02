import fs from "node:fs";
import { test, expect, scan, formatViolations } from "./fixtures.js";
import { PNG } from "pngjs";

// My registrations as tickets: the notch is a real cut-out, the perforation lines up across a row, nothing overflows,
// and axe is clean at the four widths the design is specified for. Screenshots are saved to test-results/tickets.
const future = new Date(Date.now() + 30 * 864e5).toISOString();
const events = { title: "IVEMON: ODD PLATINUM Cupsleeve Event", event_date: future, venue: "Psicom Blue Club", registration_fee: 100 };
const reg = { event_id: "e1", user_id: "u1", x_username: "juan_dc", created_at: future, events };
const REGS = [
  { ...reg, id: "t1", name: "Juan Dela Cruz", status: "confirmed", ticket_number: "IVEMONOP-000008", kit_name: "Event kit", kit_quantity: 3, total_amount: 300, payment_id: "p1", payments: { id: "p1", status: "verified" } },
  { ...reg, id: "t2", name: "Maria Santos", x_username: "maria", status: "pending_verification", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p2", payments: { id: "p2", status: "pending" } },
  { ...reg, id: "t3", name: "Pedro Reyes", x_username: "pedro", status: "pending_verification", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p3", payments: { id: "p3", status: "underpaid", amount_due: 5, review_note: "A transaction fee was deducted" } },
  { ...reg, id: "t4", name: "Ana Cruz", x_username: "faedfsadfa", status: "rejected", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p4", payments: { id: "p4", status: "rejected", review_note: "The receipt is unreadable, and the reference number does not match the receipt you attached to this form." } },
  { ...reg, id: "t5", name: "Luis Tan", x_username: "luis", status: "cancelled", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: null, payments: null },
  { ...reg, id: "t6", name: "Gina Lim", x_username: "gina", status: "confirmed", ticket_number: "IVEMONOP-000009", kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p6", payments: { id: "p6", status: "verified" } },
];

async function open(page, as, size) {
  await as("user");
  await page.route("http://localhost:54321/rest/v1/registrations*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json", "content-range": `0-5/${REGS.length}` }, body: JSON.stringify(REGS) });
  });
  await page.setViewportSize(size);
  await page.goto("/my-registrations");
  await expect(page.getByRole("heading", { level: 1, name: "My registrations" })).toBeVisible();
  await expect(page.locator(".ticket")).toHaveCount(REGS.length);
}

const SIZES = [[360, 800], [768, 1024], [1280, 800], [1600, 900]];

test.describe("ticket cards", () => {
  for (const [w, h] of SIZES) {
    test(`${w}px: tickets, no overflow, axe clean, screenshot`, async ({ page, as }) => {
      await open(page, as, { width: w, height: h });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const cols = await page.evaluate(() => new Set([...document.querySelectorAll(".ticket")].map((t) => Math.round(t.getBoundingClientRect().left))).size);
      expect(cols).toBe(w < 640 ? 1 : w < 1024 ? 2 : w < 1536 ? 3 : 4);       // the column counts from the spec
      const v = await scan(page); expect(v, `tickets at ${w}\n` + formatViolations(v)).toEqual([]);
      fs.mkdirSync("test-results/tickets", { recursive: true });
      await page.screenshot({ path: `test-results/tickets/tickets-${w}.png`, fullPage: true });
    });
  }

  test("the same data shows the same fields and buttons, in the right stub for each status", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const t = (id) => page.locator(".ticket").nth(id);
    await expect(t(0)).toContainText("Ticket no."); await expect(t(0)).toContainText("IVEMONOP-000008"); await expect(t(0)).toContainText("Event kit × 3 · ₱300.00");
    await expect(t(0).getByRole("link", { name: "View ticket IVEMONOP-000008 for IVEMON: ODD PLATINUM Cupsleeve Event" })).toBeVisible();
    await expect(t(0).getByRole("button", { name: "Copy ticket number" })).toBeVisible();
    await expect(t(1)).toContainText("Awaiting payment check"); await expect(t(1)).toContainText("48 to 72 hours");
    await expect(t(1).getByRole("link")).toHaveCount(0); await expect(t(1).locator("svg[viewBox='0 0 200 40']")).toHaveCount(0);   // no barcode, no button before it is verified
    await expect(t(2)).toContainText("Payment incomplete: ₱5.00 still due."); await expect(t(2).getByRole("button", { name: /Send the missing amount/ })).toBeVisible();
    await expect(t(3)).toContainText("Payment rejected."); await expect(t(3).getByRole("button", { name: /Upload a new receipt/ })).toBeVisible();
    await expect(t(3).locator(".ticket__stamp")).toHaveText("VOID"); await expect(t(2).locator(".ticket__stamp")).toHaveCount(0);   // the stamp is only for rejected
    await expect(t(4)).toContainText("Cancelled"); await expect(t(4).getByRole("button")).toHaveCount(0);
    for (const i of [0, 1, 2, 3, 4, 5]) await expect(t(i)).toHaveAttribute("aria-labelledby", /^reg-title-/);   // each ticket is one article named by its title
  });

  test("the notch is a real cut-out: the page background shows through it", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    await page.addStyleTag({ content: "body { background: rgb(255, 0, 0) !important; } .ticket { filter: none !important; }" });   // a loud page colour, and no shadow in the way
    const box = await page.locator(".ticket__bottom").first().boundingBox();
    const clip = { x: Math.round(box.x) + 3, y: Math.round(box.y) - 2, width: 4, height: 4 };    // just inside the left edge, on the perforation line
    const png = PNG.sync.read(await page.screenshot({ clip }));
    const px = (x, y) => { const i = (png.width * y + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
    expect(px(1, 2)).toEqual([255, 0, 0]);                                                         // red = the page, seen through the notch
    const inner = PNG.sync.read(await page.screenshot({ clip: { x: Math.round(box.x) + 60, y: Math.round(box.y) + 40, width: 2, height: 2 } }));
    expect([inner.data[0], inner.data[1], inner.data[2]]).not.toEqual([255, 0, 0]);               // while the ticket itself is solid
  });

  test("the perforation lines up across tickets in a row, even when one stub is taller", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const tops = await page.evaluate(() => [...document.querySelectorAll(".ticket")].map((t) => ({ y: Math.round(t.getBoundingClientRect().top), perf: Math.round(t.querySelector(".ticket__bottom").getBoundingClientRect().top), h: Math.round(t.getBoundingClientRect().height) })));
    for (const row of [tops.slice(0, 3), tops.slice(3, 6)]) {
      expect(new Set(row.map((r) => r.perf)).size).toBe(1);                                      // one perforation line per row
      expect(new Set(row.map((r) => r.h)).size).toBe(1);                                         // equal heights
    }
    const stubs = await page.evaluate(() => [...document.querySelectorAll(".ticket__stub")].slice(0, 3).map((s) => s.scrollHeight));
    expect(new Set(stubs).size).toBeGreaterThan(1);                                              // the stubs really do differ in height
  });

  test("keyboard: the buttons and links are reachable in order, and nothing decorative takes focus", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const names = [];
    for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); names.push(await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").trim().slice(0, 40))); }
    const viewIdx = names.findIndex((n) => n.startsWith("View ticket IVEMONOP-000008"));
    expect(viewIdx).toBeGreaterThan(-1);
    expect(names[viewIdx - 1]).toMatch(/Copy ticket number/);                                    // copy button, then the View ticket link
    expect(await page.locator(".ticket [tabindex]").count()).toBe(0);
    expect(await page.locator(".ticket__stamp[aria-hidden='true'], svg[aria-hidden='true']").count()).toBeGreaterThan(0);
  });

  test("forced colours: a plain bordered card without the mask", async ({ page, as }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page, as, { width: 1280, height: 900 });
    const mask = await page.evaluate(() => { const s = getComputedStyle(document.querySelector(".ticket__top")); return s.maskImage || s.webkitMaskImage || "none"; });
    expect(mask).toBe("none");
    const border = await page.evaluate(() => getComputedStyle(document.querySelector(".ticket__top")).borderTopWidth);
    expect(border).toBe("2px");
  });
});
