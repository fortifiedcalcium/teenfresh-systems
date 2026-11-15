import { peso } from "./payment";

/** What a shopper has to do on one order, in plain words. `required` ones need a payment or a receipt; the courier choice is optional.
 *  Anything we are checking on our side is not here: that is waiting on us, not on them. */
export function todosFor(o) {
  const out = [];
  const open = o.status === "pending" || o.status === "paid";
  if (open && o.balance_status === "awaiting_payment") {
    out.push({ type: "balance", required: true, text: `Send the remaining ${peso(o.balance_due_php)}${o.balance_for === "shipping" ? " of your shipping fee" : " of your payment"}.`, note: o.balance_note });
  } else if (o.status === "paid" && o.shipping_status === "awaiting_payment") {
    out.push({ type: "shipping_fee", required: true, text: `Pay your shipping fee of ${peso(o.shipping_fee_php)}.`, note: o.shipping_note ? `Your last receipt was sent back: ${o.shipping_note}` : null });
  }
  if (open && o.shipping_status === "none" && !o.preferred_courier) out.push({ type: "courier", required: false, text: "Choose the courier you would like (optional).", note: null });
  return out.map((t) => ({ ...t, key: `${o.id}:${t.type}:${t.type === "balance" ? o.balance_due_php : t.type === "shipping_fee" ? o.shipping_fee_php : ""}`, orderId: o.id, orderNumber: o.order_number, to: `/orders/${o.id}` }));
}

/** Every to-do across a person's orders, the required ones first. */
export const allTodos = (orders) => (orders || []).flatMap(todosFor).sort((a, b) => Number(b.required) - Number(a.required));
export const requiredCount = (todos) => todos.filter((t) => t.required).length;
