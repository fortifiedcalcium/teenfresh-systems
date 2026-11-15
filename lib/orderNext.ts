import { peso } from "./payment";

export const NEXT = {
  pending: "We are checking your GCash payment. This takes 48 to 72 hours. We will update this page when it is confirmed.",
  paid: "Your payment is confirmed. We are preparing your order for shipping.",   // the shipping step below adds to this
  shipped: "Your order is on its way.",
  cancelled: "This order was cancelled.",
};

/** What happens next, including the separate shipping payment. Orders from before that step have shipping_status "paid". */
export function nextText(order) {
  if (order.balance_status === "awaiting_payment") return `Your payment was short. Please send the remaining ${peso(order.balance_due_php)} below.`;
  if (order.balance_status === "pending_review") return "We received your extra payment and are checking it. We will update this page when it is confirmed.";
  if (order.status !== "paid") return NEXT[order.status];
  switch (order.shipping_status) {
    case "none": return "Your payment is confirmed. We will set your shipping fee next and email you when it is ready to pay.";
    case "awaiting_payment": return `Your payment is confirmed. Please pay your shipping fee of ${peso(order.shipping_fee_php)} below so we can ship your order.`;
    case "pending_review": return "Your payment is confirmed. We are checking your shipping payment. We will update this page when it is confirmed.";
    default: return NEXT.paid;
  }
}
