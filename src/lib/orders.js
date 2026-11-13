import { callFunction } from "./api.js";
import { isValidReference, normalizePhone, normalizeReference } from "./payment.js";

export const MAX_QTY = 10;
export const STATUS = {
  pending:   { tone: "warn", label: "Awaiting payment check" },
  paid:      { tone: "ok",   label: "Paid" },
  shipped:   { tone: "info", label: "Shipped" },
  cancelled: { tone: "bad",  label: "Cancelled" },
};
const cents = (n) => Math.round(Number(n || 0) * 100);

/** The totals of a cart: lines are { price, quantity } in US dollars; settings hold the rate and the shipping fee in pesos.
 *  The database repeats this sum in place_order() and uses its own prices; this is only what the shopper sees first. */
export function priceOrder(lines, settings) {
  const subtotalCents = lines.reduce((a, l) => a + cents(l.price) * l.quantity, 0);
  const rate = Number(settings?.usd_to_php || 0);
  const subtotalPhp = Math.round(subtotalCents * rate) / 100;                // dollars x rate, rounded to the centavo
  const shippingPhp = Number(settings?.shipping_fee_php || 0);
  return { subtotalUsd: subtotalCents / 100, subtotalPhp, shippingPhp, totalPhp: Math.round((subtotalPhp + shippingPhp) * 100) / 100 };
}

/** One problem per field, in plain words. The database checks the same rules. */
export function validateCheckout(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Enter your full name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!normalizePhone(f.phone)) e.phone = "Enter a Philippine mobile number, like 09171234567";
  if (!f.address.trim()) e.address = "Enter your street address";
  if (!f.city.trim()) e.city = "Enter your city";
  if (!/^\d{4}$/.test(f.postal_code.trim())) e.postal_code = "Enter your 4-digit postal code";
  if (!f.sender_name.trim()) e.sender_name = "Enter the name on the GCash account you paid from";
  if (!isValidReference(f.reference_number)) e.reference_number = "Enter the reference number exactly as GCash shows it";
  return e;
}

export const orderArgs = (f, items, receiptPathValue) => ({
  p_items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
  p_name: f.name.trim(), p_email: f.email.trim(), p_phone: f.phone, p_address: f.address.trim(), p_city: f.city.trim(), p_postal: f.postal_code.trim(),
  p_notes: f.notes.trim() || null, p_sender: f.sender_name.trim(), p_reference: normalizeReference(f.reference_number), p_receipt_path: receiptPathValue,
});

/** Asks the send-order-email function to email the shopper. Never throws: returns { ok, error }. A failed email never undoes an order or a status change. */
export async function sendOrderEmail(kind, orderId) {
  try { await callFunction("send-order-email", { kind, order_id: orderId }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}
