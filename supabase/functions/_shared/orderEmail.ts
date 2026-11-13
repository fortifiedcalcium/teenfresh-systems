// Builds the shop order emails. Pure functions, no network: the Edge Function sends what these return.
import { escapeHtml as e } from "./merge.ts";

export const ORDER_KINDS = ["order_received", "order_paid", "order_shipped", "order_cancelled"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];
/** The order status each admin email announces (order_received is sent when the order is placed, status "pending"). */
export const KIND_STATUS: Record<OrderKind, string> = { order_received: "pending", order_paid: "paid", order_shipped: "shipped", order_cancelled: "cancelled" };

export interface OrderRow { id: string; order_number: string; name: string; email: string; phone: string; address: string; city: string; postal_code: string; subtotal_usd: number | string; usd_to_php: number | string; shipping_php: number | string; total_php: number | string }
export interface ItemRow { artist: string; title: string; unit_price_usd: number | string; quantity: number }

const usd = (n: unknown) => "$" + Number(n).toFixed(2);
const php = (n: unknown) => "PHP " + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COPY: Record<OrderKind, { subject: (n: string) => string; heading: string; body: string }> = {
  order_received: { subject: (n) => `We received your order ${n}`, heading: "Thank you for your order!", body: "We received your order and your GCash receipt. We are checking your payment now, which takes 48 to 72 hours. We will email you again when it is confirmed." },
  order_paid:     { subject: (n) => `Payment confirmed for order ${n}`, heading: "Your payment is confirmed", body: "We checked your GCash payment and it is confirmed. We are now preparing your order for shipping." },
  order_shipped:  { subject: (n) => `Your order ${n} has shipped`, heading: "Your order is on its way", body: "Your order has been shipped to the address below. It should reach you soon." },
  order_cancelled:{ subject: (n) => `Your order ${n} was cancelled`, heading: "Your order was cancelled", body: "Your order was cancelled. If you already paid and think this is a mistake, reply to this email and we will help." },
};

export function renderOrderEmail(kind: OrderKind, o: OrderRow, items: ItemRow[], site: string) {
  const c = COPY[kind];
  const link = site ? `${site.replace(/\/$/, "")}/orders/${o.id}` : "";
  const rows = items.map((i) => `<tr><td style="padding:6px 0;">${e(i.artist)}<br><strong>${e(i.title)}</strong></td><td style="padding:6px 0;text-align:right;white-space:nowrap;">${usd(i.unit_price_usd)} × ${i.quantity}</td></tr>`).join("");
  const shipping = Number(o.shipping_php) > 0 ? php(o.shipping_php) : "Free";
  const html = `<!doctype html><html><body style="margin:0;background:#f1d0d9;font-family:Arial,Helvetica,sans-serif;color:#17303f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#f9e7b9;padding:16px 24px;font-size:20px;font-weight:bold;">Teenfresh</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 8px 0;font-size:22px;">${e(c.heading)}</h1>
<p style="margin:0 0 16px 0;">Hi ${e(o.name)}, ${e(c.body)}</p>
<p style="margin:0 0 8px 0;"><strong>Order ${e(o.order_number)}</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #c4d6ea;border-bottom:1px solid #c4d6ea;font-size:14px;">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:8px;">
<tr><td>Items (at PHP ${Number(o.usd_to_php)} per $1)</td><td style="text-align:right;">${usd(o.subtotal_usd)}</td></tr>
<tr><td>Shipping</td><td style="text-align:right;">${e(shipping)}</td></tr>
<tr><td style="padding-top:6px;"><strong>Total paid (GCash)</strong></td><td style="padding-top:6px;text-align:right;"><strong>${php(o.total_php)}</strong></td></tr></table>
<p style="margin:16px 0 4px 0;"><strong>Deliver to</strong></p>
<p style="margin:0 0 16px 0;font-size:14px;">${e(o.name)}<br>${e(o.address)}<br>${e(o.city)} ${e(o.postal_code)}<br>${e(o.phone)}</p>
${link ? `<p style="margin:0 0 8px 0;"><a href="${e(link)}" style="color:#1c5a85;">View your order</a></p>` : ""}
<p style="margin:16px 0 0 0;font-size:12px;color:#2b4c63;">Teenfresh</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    c.heading, "", `Hi ${o.name}, ${c.body}`, "", `Order ${o.order_number}`,
    ...items.map((i) => `- ${i.artist}: ${i.title}  ${usd(i.unit_price_usd)} x ${i.quantity}`), "",
    `Items (at PHP ${Number(o.usd_to_php)} per $1): ${usd(o.subtotal_usd)}`, `Shipping: ${shipping}`, `Total paid (GCash): ${php(o.total_php)}`, "",
    "Deliver to:", o.name, o.address, `${o.city} ${o.postal_code}`, o.phone,
    ...(link ? ["", `View your order: ${link}`] : []),
  ].join("\n");
  return { subject: c.subject(o.order_number), html, text };
}
