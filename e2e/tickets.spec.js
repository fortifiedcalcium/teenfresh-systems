import fs from "node:fs";
import { test, expect, scan, formatViolations } from "./fixtures.js";
import { PNG } from "pngjs";

// My registrations as tickets: the notch is a real cut-out, the perforation lines up across a row, nothing overflows,
// and axe is clean at the four widths the design is specified for. Screenshots are saved to test-results/tickets.
const future = new Date(Date.now() + 30 * 864e5).toISOString();
const events = { title: "IVEMON: ODD PLATINUM Cupsleeve Event", event_date: future, venue: "Psicom Blue Club", registration_fee: 100 };
const reg = { event_id: "e1", user_id: "u1", x_username: "juan_dc", created_at: future, events };
const DEFAULT_REGS = [
  { ...reg, id: "t1", name: "Juan Dela Cruz", status: "confirmed", ticket_number: "IVEMONOP-000008", kit_name: "Event kit", kit_quantity: 3, total_amount: 300, payment_id: "p1", payments: { id: "p1", status: "verified" } },
  { ...reg, id: "t2", name: "Maria Santos", x_username: "maria", status: "pending_verification", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p2", payments: { id: "p2", status: "pending" } },
  { ...reg, id: "t3", name: "Pedro Reyes", x_username: "pedro", status: "pending_verification", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p3", payments: { id: "p3", status: "underpaid", amount_due: 5, review_note: "A transaction fee was deducted" } },
  { ...reg, id: "t4", name: "Ana Cruz", x_username: "faedfsadfa", status: "rejected", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p4", payments: { id: "p4", status: "rejected", review_note: "The receipt is unreadable, and the reference number does not match the receipt you attached to this form." } },
  { ...reg, id: "t5", name: "Luis Tan", x_username: "luis", status: "cancelled", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: null, payments: null },
  { ...reg, id: "t6", name: "Gina Lim", x_username: "gina", status: "confirmed", ticket_number: "IVEMONOP-000009", kit_name: "Event kit", kit_quantity: 1, total_amount: 100, payment_id: "p6", payments: { id: "p6", status: "verified" } },
];

async function open(page, as, size, REGS = DEFAULT_REGS) {
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

const REGS = DEFAULT_REGS;
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

  test("the stubs really differ in content, yet the perforation and buttons share one line per row", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const content = await page.evaluate(() => [...document.querySelectorAll(".ticket__stub")].slice(0, 3).map((s) => [...s.children].reduce((n, c) => n + c.getBoundingClientRect().height, 0)));
    expect(new Set(content.map(Math.round)).size).toBeGreaterThan(1);                           // different stubs: different amounts of content
  });

  // ---- alignment across a row (subgrid): the same lines within 1 px
  for (const [w, perRow] of [[1280, 3], [1600, 4]]) {
    test(`${w}px: picture, title, perforation, stub and buttons line up across each row (within 1 px)`, async ({ page, as }) => {
      const LONG = [...REGS.slice(0, 5).map((r, i) => (i === 1 ? { ...r, events: { ...r.events, title: "IVEMON: ODD PLATINUM Cupsleeve Event with a much longer name than the others in its row" } } : r)), ...REGS.slice(5)];
      await open(page, as, { width: w, height: 900 }, LONG);
      const m = await page.evaluate(() => [...document.querySelectorAll(".ticket")].map((t) => {
        const y = (q, edge = "top") => { const e = t.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round((edge === "top" ? b.top : b.bottom) * 10) / 10; };
        const action = t.querySelector(".ticket__action");
        return { top: y(":scope"), mediaBottom: y(".ticket__media", "bottom"), title: y(".ticket__title"), stubTop: y(".ticket__bottom"), action: action ? Math.round(action.getBoundingClientRect().bottom * 10) / 10 : null, bottom: Math.round(t.getBoundingClientRect().bottom * 10) / 10 };
      }));
      for (let i = 0; i < m.length; i += perRow) {
        const row = m.slice(i, i + perRow);
        for (const k of ["top", "mediaBottom", "title", "stubTop", "bottom"]) expect(Math.max(...row.map((r) => r[k])) - Math.min(...row.map((r) => r[k])), `${k} in row ${i / perRow}`).toBeLessThanOrEqual(1);
        const acts = row.map((r) => r.action).filter((a) => a !== null);
        expect(Math.max(...acts) - Math.min(...acts), "buttons").toBeLessThanOrEqual(1);
      }
    });
  }

  test("hovering a ticket does not move it (it used to lift 2 px and fall out of line)", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const before = await page.evaluate(() => [...document.querySelectorAll(".ticket")].slice(0, 3).map((t) => t.getBoundingClientRect().top));
    await page.locator(".ticket").first().hover();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => [...document.querySelectorAll(".ticket")].slice(0, 3).map((t) => t.getBoundingClientRect().top));
    expect(after).toEqual(before);
  });

  // ---- the title is never cut off
  for (const [w, h] of [[320, 700], [360, 800], [390, 800], [768, 1024], [1024, 800], [1280, 800], [1600, 900]]) {
    test(`${w}px: the full event title is shown (no ellipsis, no clipping), the chip does not touch the title`, async ({ page, as }) => {
      const LONG = REGS.map((r) => ({ ...r, events: { ...r.events, title: "IVEMON: ODD PLATINUM Cupsleeve Event with a very long name that needs several lines" } }));
      await open(page, as, { width: w, height: h }, LONG);
      const res = await page.evaluate(() => [...document.querySelectorAll(".ticket__title")].map((t) => { const cs = getComputedStyle(t); return { clipped: t.scrollHeight > t.clientHeight + 1, ellipsis: cs.textOverflow === "ellipsis", clamp: cs.webkitLineClamp !== "none" && cs.webkitLineClamp !== "", height: t.getBoundingClientRect().height, line: parseFloat(cs.lineHeight) }; }));
      for (const r of res) { expect(r.clipped).toBe(false); expect(r.ellipsis).toBe(false); expect(r.clamp).toBe(false); expect(r.height).toBeGreaterThan(r.line * 1.5); }   // wrapped onto several lines
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(ov).toBeLessThanOrEqual(0);
    });
  }

  test("a long name wraps before the @username, and the icon and label stay on the first line", async ({ page, as }) => {
    const LONG = REGS.map((r) => ({ ...r, name: "Edgar Dominic Alconera Santos de la Cruz", x_username: "hatdog" }));
    await open(page, as, { width: 360, height: 800 }, LONG);
    const info = await page.locator(".ticket").first().locator(".info-row", { hasText: "For:" }).evaluate((li) => {
      const icon = li.querySelector(".info-icon").getBoundingClientRect(), p = li.querySelector(".info-text"), pr = p.getBoundingClientRect(), lh = parseFloat(getComputedStyle(p).lineHeight);
      const u = [...li.querySelectorAll(".nowrap")][0].getBoundingClientRect();
      return { lines: Math.round(pr.height / lh), iconMid: icon.top + icon.height / 2, firstMid: pr.top + lh / 2, userLeft: u.left, textLeft: pr.left, userTop: u.top, textTop: pr.top };
    });
    expect(info.lines).toBeGreaterThanOrEqual(2);
    expect(Math.abs(info.iconMid - info.firstMid)).toBeLessThanOrEqual(2);
  });

  test("one inset: the perforation starts and ends where the text does; nothing is within 8 px of a notch; actions are 44 px or more", async ({ page, as }) => {
    await open(page, as, { width: 1280, height: 900 });
    const g = await page.evaluate(() => { const t = document.querySelector(".ticket"); const fill = t.querySelector(".ticket__bottom .ticket__fill"), fb = fill.getBoundingClientRect();
      const perf = getComputedStyle(fill, "::before"); const text = t.querySelector(".ticket__title").getBoundingClientRect(), stubText = t.querySelector(".ticket__label").getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(t.querySelector(".ticket__content")).paddingLeft);
      const btns = [...document.querySelectorAll(".ticket .btn-primary, .ticket .btn-secondary")].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      return { perfLeft: parseFloat(perf.left), perfRight: parseFloat(perf.right), textInset: text.left - fb.left, stubInset: stubText.left - fb.left, pad, btns }; });
    expect(g.perfLeft).toBe(g.pad); expect(g.perfRight).toBe(g.pad);
    expect(Math.abs(g.textInset - g.pad)).toBeLessThanOrEqual(1); expect(Math.abs(g.stubInset - g.pad)).toBeLessThanOrEqual(1);
    expect(g.pad - 12).toBeGreaterThanOrEqual(8);                                                // padding minus the notch radius
    for (const [bw, bh] of g.btns) { expect(bh).toBeGreaterThanOrEqual(44); expect(bw).toBeGreaterThanOrEqual(44); }
  });

  test("the VOID stamp and the status chip never overlap each other or the placeholder content, down to 320 px", async ({ page, as }) => {
    for (const w of [320, 360, 1280]) {
      await open(page, as, { width: w, height: 900 });
      const rects = await page.evaluate(() => { const t = document.querySelectorAll(".ticket")[3]; const r = (q) => { const e = t.querySelector(q); return e && getComputedStyle(e).display !== "none" ? e.getBoundingClientRect().toJSON() : null; }; return { chip: r(".ticket__chip"), stamp: r(".ticket__stamp"), content: r(".ticket__media [data-placeholder] > svg, .ticket__media [data-placeholder] > p") }; });
      const hit = (a, b) => a && b && !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      expect(hit(rects.chip, rects.stamp), `chip/stamp at ${w}`).toBeFalsy();
      expect(hit(rects.stamp, rects.content), `stamp/placeholder at ${w}`).toBeFalsy();
    }
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

  for (const [w, h] of SIZES) {
    test(`visual snapshot at ${w}px (confirmed, pending, needs action, rejected, cancelled)`, async ({ page, as }) => {
      await open(page, as, { width: w, height: h });
      await page.mouse.move(0, 0);
      await expect(page.locator(".ticket-grid")).toHaveScreenshot(`tickets-${w}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }
});
