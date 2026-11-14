import { describe, expect, it } from "vitest";
import { orderReport, orderReportFilename } from "../src/lib/orderReport.js";

const at = (d) => new Date(2026, 10, d, 14, 5).toISOString();
const base = { id: "a", order_number: "TF-000001", created_at: at(10), status: "pending", shipping_status: "none", balance_status: "none", subtotal_php: 1500, shipping_php: 0, total_php: 1500, name: "Juan Dela Cruz", email: "juan@example.com", phone: "+639171234567", address: "12 Rizal St.", city: "Makati City, Metro Manila (NCR)", postal_code: "1210", reference_number: "111" };
const orders = [
  base,
  { ...base, id: "b", order_number: "TF-000002", created_at: at(12), status: "shipped", shipping_status: "paid", shipping_fee_php: 150, shipping_reference_number: "222", balance_paid_php: 250, balance_references: [{ for: "items", reference: "idfuwe" }, { for: "shipping", reference: "6767676" }], courier: "LBC", tracking_number: "LBC123", preferred_courier: "LBC", reference_number: "154545", name: "=HYPERLINK(\"http://evil\")", notes: "Leave at the gate" },
  { ...base, id: "c", order_number: "TF-000003", created_at: at(11), status: "cancelled", subtotal_php: 300, total_php: 300 },
  { ...base, id: "d", order_number: "TF-000004", created_at: at(13), status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 80, total_php: 1500 },
];
const items = [
  { order_id: "a", artist: "Marv", title: "ÖRBITAL", unit_price_php: 750, quantity: 2 },
  { order_id: "b", artist: "KASSY", title: "EP [ODYSSEY]", unit_price_php: 300, quantity: 1 },
  { order_id: "b", artist: "Marv", title: "Photobook", unit_price_php: 1200, quantity: 1 },
  { order_id: "c", artist: "Marv", title: "ÖRBITAL", unit_price_php: 300, quantity: 1 },
];
const sheets = orderReport(orders, items);
const by = (name) => sheets.find((s) => s.name === name);
const col = (sheet, name) => by(sheet).head.indexOf(name);

describe("shop orders report", () => {
  it("has the three sheets: Orders, Items and Summary", () => {
    expect(sheets.map((s) => s.name)).toEqual(["Orders", "Items", "Summary"]);
    for (const s of sheets) for (const r of s.rows) expect(r).toHaveLength(s.head.length);      // every row fits its header
  });
  it("lists every order once, newest first, with its status the way shoppers see it", () => {
    const o = by("Orders");
    expect(o.rows.map((r) => r[0])).toEqual(["TF-000004", "TF-000002", "TF-000003", "TF-000001"]);
    const status = (no) => o.rows.find((r) => r[0] === no)[col("Orders", "Status")];
    expect(status("TF-000001")).toBe("Awaiting payment");
    expect(status("TF-000004")).toBe("Awaiting payment");              // confirmed, but the shipping fee is still to pay
    expect(status("TF-000002")).toBe("Shipped");
    expect(status("TF-000003")).toBe("Cancelled");
  });
  it("puts the order's items on its row and one row per product in the Items sheet", () => {
    const o = by("Orders").rows.find((r) => r[0] === "TF-000002");
    expect(o[col("Orders", "Items")]).toBe("1 × EP [ODYSSEY] (KASSY); 1 × Photobook (Marv)");
    const it = by("Items");
    expect(it.rows).toHaveLength(4);
    const line = it.rows.find((r) => r[0] === "TF-000002" && r[4] === "Photobook");
    expect(line.slice(5)).toEqual(["", 1200, 1, 1200]);                  // variation (none), unit price, quantity, line total
  });
  it("names the chosen variation on the order row and in the Items sheet", () => {
    const withVersion = orderReport([{ ...base, id: "v" }], [{ order_id: "v", artist: "Marv", title: "ÖRBITAL", variation_name: "Version B", unit_price_php: 900, quantity: 2 }]);
    expect(withVersion[0].rows[0][9]).toBe("2 × ÖRBITAL [Version B] (Marv)");
    expect(withVersion[1].head).toContain("Variation");
    expect(withVersion[1].rows[0].slice(3, 8)).toEqual(["Marv", "ÖRBITAL", "Version B", 900, 2]);
  });
  it("lists every payment reference on one line each, in the same format as the order window", () => {
    const o = by("Orders").rows.find((r) => r[0] === "TF-000002");
    expect(o[col("Orders", "Payment references")]).toBe("Item Fee: 154545\nUnderpayment: idfuwe\nShipping Fee: 222\nUnderpayment: 6767676");
  });
  it("gives the money as numbers: items, shipping, extra payments, and what was received", () => {
    const o = by("Orders").rows;
    const get = (no, name) => o.find((r) => r[0] === no)[col("Orders", name)];
    expect(get("TF-000002", "Items total (PHP)")).toBe(1500);
    expect(get("TF-000002", "Shipping fee (PHP)")).toBe(150);
    expect(get("TF-000002", "Extra payments confirmed (PHP)")).toBe(250);
    expect(get("TF-000002", "Amount received (PHP)")).toBe(1650);        // the items and the shipping fee, both paid
    expect(get("TF-000004", "Amount received (PHP)")).toBe(1500);        // the items only: its shipping fee is not paid yet
    expect(get("TF-000001", "Amount received (PHP)")).toBe(0);           // not confirmed
    expect(get("TF-000003", "Amount received (PHP)")).toBe(0);           // cancelled
    expect(typeof get("TF-000002", "Amount received (PHP)")).toBe("number");
    expect(get("TF-000004", "Shipping payment")).toBe("Awaiting payment");
    expect(get("TF-000003", "Shipping payment")).toBe("");
  });
  it("includes the courier, the tracking number and the notes", () => {
    const o = by("Orders").rows.find((r) => r[0] === "TF-000002");
    expect([o[col("Orders", "Preferred courier")], o[col("Orders", "Courier used")], o[col("Orders", "Tracking number")], o[col("Orders", "Customer's note")]]).toEqual(["LBC", "LBC", "LBC123", "Leave at the gate"]);
  });
  it("sums up the shop in the Summary", () => {
    const s = Object.fromEntries(by("Summary").rows.map(([k, v]) => [k.trim(), v]));
    expect(s["Orders in this report"]).toBe(4);
    expect(s["Awaiting payment"]).toBe(2);
    expect(s["Shipped"]).toBe(1);
    expect(s["Cancelled"]).toBe(1);
    expect(s["Products ordered (cancelled orders left out)"]).toBe(4);        // TF-000001 has 2, TF-000002 has 2; the cancelled one does not count
    expect(s["Items total, confirmed orders (PHP)"]).toBe(3000);              // TF-000002 and TF-000004
    expect(s["Shipping fees paid (PHP)"]).toBe(150);
    expect(s["Amount received in total (PHP)"]).toBe(3150);
    expect(s["Report made"]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  it("never exports receipts, and copes with no orders at all", () => {
    expect(JSON.stringify(orderReport([{ ...base, receipt_path: "u1/secret.png", shipping_receipt_path: "u1/s.png" }], []))).not.toContain("secret.png");
    const empty = orderReport([], []);
    expect(empty.map((s) => s.rows.length)).toEqual([0, 0, expect.any(Number)]);
    expect(orderReport(null, null)[0].rows).toEqual([]);
  });
  it("names the file with today's date", () => {
    expect(orderReportFilename(new Date(2026, 10, 14))).toBe("shop-orders-2026-11-14.xlsx");
    expect(orderReportFilename(new Date(2026, 0, 5))).toBe("shop-orders-2026-01-05.xlsx");
  });
});
