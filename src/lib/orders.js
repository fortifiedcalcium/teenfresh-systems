import { callFunction } from "./api.js";
import { isValidReference, normalizePhone, normalizeReference } from "./payment.js";

export const MAX_QTY = 10;
export const STATUS = {
  pending:   { tone: "warn", label: "Awaiting payment" },     // the payment is not confirmed yet
  paid:      { tone: "ok",   label: "Paid" },
  shipped:   { tone: "info", label: "Shipped" },
  cancelled: { tone: "bad",  label: "Cancelled" },
};
/** The shipping payment that comes after the order is confirmed. */
/** Everything is paid: the order is confirmed and its shipping fee is paid (or there is none). Orders from before the shipping step count as paid. */
export const isFullyPaid = (o) => (o.status === "paid" || o.status === "shipped") && (o.shipping_status ?? "paid") === "paid" && (o.balance_status ?? "none") === "none";
/** Which payment an admin can ask a remaining amount for right now: "items" (order pending), "shipping" (its receipt is being checked), or null. */
export const balanceStage = (o) => (o.balance_status === undefined ? null : o.status === "pending" ? "items" : o.status === "paid" && o.shipping_status === "pending_review" ? "shipping" : null);
export const SHIPPING = {
  none:             { tone: "neutral", label: "Shipping fee not set yet" },
  awaiting_payment: { tone: "warn",    label: "Shipping fee to pay" },
  pending_review:   { tone: "warn",    label: "Checking shipping payment" },
  paid:             { tone: "ok",      label: "Shipping paid" },
};
/** The couriers a new shop starts with (migration 023 stores them in the database, where an admin edits the list). "Other" lets anyone type any name. */
export const DEFAULT_COURIERS = ["J&T Express", "LBC", "JRS Express", "Ninja Van", "Flash Express", "2GO", "Lalamove", "Grab Express", "Pick-up by the shopper"];
export const OTHER_COURIER = "Other";
export const MAX_TRACKING = 60;
export const COURIER_MAX = 60;
/** A problem with a new courier name, or "" when it is fine. `existing` are the names already in the list. */
export function validateCourierName(name, existing = []) {
  const n = String(name).trim();
  if (!n) return "Type a courier name.";
  if (n.length > COURIER_MAX) return `A courier name can be ${COURIER_MAX} characters at most.`;
  if (n.toLowerCase() === OTHER_COURIER.toLowerCase()) return `"${OTHER_COURIER}" is always offered, so it cannot be added.`;
  if (existing.some((e) => e.trim().toLowerCase() === n.toLowerCase())) return "That courier already exists.";
  return "";
}
/** A saved courier name as the dropdown shows it: a listed courier, or "Other" with the typed name. */
export function splitCourier(name, couriers = []) {
  if (!name) return { choice: "", other: "" };
  return couriers.includes(name) ? { choice: name, other: "" } : { choice: OTHER_COURIER, other: name };
}
/** The courier name to save, or an error message. `other` is the typed name when "Other" is chosen. */
export function courierValue(choice, other) {
  const name = (choice === OTHER_COURIER ? other : choice || "").trim();
  if (!name) return { error: choice === OTHER_COURIER ? "Type the courier's name." : "Choose the courier." };
  if (name.length > 60) return { error: "The courier name can be 60 characters at most." };
  return { value: name };
}
const cents = (n) => Math.round(Number(n || 0) * 100);

/** The totals of a cart: lines are { price, quantity } in pesos; the shipping fee is set later by an admin and paid separately, so checkout only charges for the items.
 *  The database repeats this sum in place_order() and uses its own prices; this is only what the shopper sees first. */
export function priceOrder(lines) {
  const subtotalCents = lines.reduce((a, l) => a + cents(l.price) * l.quantity, 0);
  const subtotalPhp = subtotalCents / 100;
  return { subtotalPhp, totalPhp: subtotalPhp };
}

/** One problem per field, in plain words. The database checks the same rules. */
export function validateCheckout(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Enter your full name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!normalizePhone(f.phone)) e.phone = "Enter a Philippine mobile number, like 09171234567";
  if (!f.address.trim()) e.address = "Enter your street address";
  if (!f.province) e.province = "Choose your province";
  if (!f.city) e.city = "Choose your city or municipality";
  if (!/^\d{4}$/.test(f.postal_code.trim())) e.postal_code = "Enter your 4-digit postal code";
  if (!f.sender_name.trim()) e.sender_name = "Enter the name on the GCash account you paid from";
  if (!isValidReference(f.reference_number)) e.reference_number = "Enter the reference number exactly as GCash shows it";
  return e;
}

export const orderArgs = (f, items, receiptPathValue) => ({
  p_items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
  p_name: f.name.trim(), p_email: f.email.trim(), p_phone: f.phone, p_address: f.address.trim(), p_city: `${f.city}, ${f.province}`,                       // the city column keeps both, for example "Makati City, Metro Manila (NCR)"
   p_postal: f.postal_code.trim(),
  p_notes: f.notes.trim() || null, p_sender: f.sender_name.trim(), p_reference: normalizeReference(f.reference_number), p_receipt_path: receiptPathValue,
});

/** Asks the send-order-email function to email the shopper. Never throws: returns { ok, error }. A failed email never undoes an order or a status change. */
export async function sendOrderEmail(kind, orderId) {
  try { await callFunction("send-order-email", { kind, order_id: orderId }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}
