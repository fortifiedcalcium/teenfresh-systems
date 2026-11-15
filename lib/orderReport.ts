import { STATUS, displayStatus, paymentReferences } from "./orders";

const pad = (n) => String(n).padStart(2, "0");
/** 2026-11-14 19:29, in the admin's own time, as text so every spreadsheet program shows it the same way. */
const stamp = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const SHIPPING_TEXT = { none: "Fee not set yet", awaiting_payment: "Awaiting payment", pending_review: "Being checked", paid: "Paid" };

/** What the shopper paid for shipping: the separate fee (new orders) or the fee that was part of the order (older ones). */
const shippingFee = (o) => num(o.shipping_fee_php ?? o.shipping_php);
/** Money actually received for the order: the items once confirmed, plus the shipping fee once it is paid (extra payments complete these). */
const received = (o) => (o.status === "paid" || o.status === "shipped" ? num(o.total_php) : 0) + (o.status !== "cancelled" && o.shipping_fee_php != null && o.shipping_status === "paid" ? num(o.shipping_fee_php) : 0);

/** The shop orders rundown as three sheets: Orders (one row per order), Items (one row per product line) and a Summary.
 *  Receipts are never exported, only the reference numbers that are kept. */
export function orderReport(orders, items) {
  const lines = new Map();
  for (const i of items || []) { if (!lines.has(i.order_id)) lines.set(i.order_id, []); lines.get(i.order_id).push(i); }
  const label = (o) => STATUS[displayStatus(o)]?.label || o.status;
  const sorted = [...(orders || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const orderRows = sorted.map((o) => {
    const ls = lines.get(o.id) || [];
    return [
      o.order_number, stamp(o.created_at), label(o), o.name, o.email, o.phone, o.address, o.city, o.postal_code,
      ls.map((l) => `${l.quantity} × ${l.title}${l.variation_name ? ` [${l.variation_name}]` : ""} (${l.artist})`).join("; "),
      num(o.subtotal_php), shippingFee(o), o.status === "cancelled" ? "" : (SHIPPING_TEXT[o.shipping_status] ?? ""),
      num(o.balance_paid_php), received(o),
      paymentReferences(o).map((r) => `${r.label}: ${r.reference}`).join("\n"),
      o.preferred_courier || "", o.courier || "", o.tracking_number || "", o.notes || "", o.admin_note || "",
    ];
  });
  const orderHead = ["Order no.", "Placed", "Status", "Customer", "Email", "Mobile", "Street address", "City and province", "Postal code", "Items", "Items total (PHP)", "Shipping fee (PHP)", "Shipping payment",
    "Extra payments confirmed (PHP)", "Amount received (PHP)", "Payment references", "Preferred courier", "Courier used", "Tracking number", "Customer's note", "Admin note"];

  const itemRows = sorted.flatMap((o) => (lines.get(o.id) || []).map((l) => [o.order_number, stamp(o.created_at), o.name, l.artist, l.title, l.variation_name || "", num(l.unit_price_php), l.quantity, num(l.unit_price_php) * l.quantity]));
  const itemHead = ["Order no.", "Placed", "Customer", "Artist", "Product", "Variation", "Unit price (PHP)", "Quantity", "Line total (PHP)"];

  const live = sorted.filter((o) => o.status !== "cancelled");
  const count = (fn) => sorted.filter(fn).length;
  const units = live.reduce((n, o) => n + (lines.get(o.id) || []).reduce((m, l) => m + l.quantity, 0), 0);
  const summary = [
    ["Orders in this report", sorted.length],
    ...Object.keys(STATUS).map((k) => [`   ${STATUS[k].label}`, count((o) => displayStatus(o) === k)]).filter(([, n]) => Number(n) > 0),
    ["Products ordered (cancelled orders left out)", units],
    ["Items total, confirmed orders (PHP)", live.filter((o) => o.status === "paid" || o.status === "shipped").reduce((t, o) => t + num(o.subtotal_php), 0)],
    ["Shipping fees paid (PHP)", live.filter((o) => o.shipping_status === "paid" && o.shipping_fee_php != null).reduce((t, o) => t + num(o.shipping_fee_php), 0)],
    ["Extra payments confirmed (PHP)", live.reduce((t, o) => t + num(o.balance_paid_php), 0)],
    ["Amount received in total (PHP)", sorted.reduce((t, o) => t + received(o), 0)],
    ["Report made", stamp(new Date().toISOString())],
  ].map(([k, v]) => [k, typeof v === "number" ? num(v) : v]);

  return [
    { name: "Orders", head: orderHead, rows: orderRows },
    { name: "Items", head: itemHead, rows: itemRows },
    { name: "Summary", head: ["Measure", "Value"], rows: summary },
  ];
}
export const orderReportFilename = (now = new Date()) => `shop-orders-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
