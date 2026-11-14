import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { SHIPPING, STATUS } from "../../lib/orders.js";
import ShippingPayment from "../../components/ShippingPayment.jsx";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { IconCheck, IconPackage } from "../../components/NavIcons.jsx";

export const NEXT = {
  pending: "We are checking your GCash payment. This takes 48 to 72 hours. We will update this page when it is confirmed.",
  paid: "Your payment is confirmed. We are preparing your order for shipping.",   // the shipping step below adds to this
  shipped: "Your order is on its way.",
  cancelled: "This order was cancelled.",
};

/** One order: used right after checkout (with a thank-you banner) and from My orders. Only the owner and admins can open it (RLS). */
/** What happens next, including the separate shipping payment. Orders from before that step have shipping_status "paid". */
export function nextText(order) {
  if (order.status !== "paid") return NEXT[order.status];
  switch (order.shipping_status) {
    case "none": return "Your payment is confirmed. We will set your shipping fee next and email you when it is ready to pay.";
    case "awaiting_payment": return `Your payment is confirmed. Please pay your shipping fee of ${peso(order.shipping_fee_php)} below so we can ship your order.`;
    case "pending_review": return "Your payment is confirmed. We are checking your shipping payment. We will update this page when it is confirmed.";
    default: return NEXT.paid;
  }
}

export default function OrderDetail() {
  const { id } = useParams();
  const placed = useLocation().state?.placed;
  const [order, setOrder] = useState(undefined);       // undefined loading, null not found
  const [items, setItems] = useState([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, it] = await Promise.all([supabase.from("orders").select("*").eq("id", id).maybeSingle(), supabase.from("order_items").select("*").eq("order_id", id).order("title")]);
      if (!alive) return;
      setOrder(o.data || null); setItems(it.data || []);
    })();
    return () => { alive = false; };
  }, [id, reload]);

  if (order === undefined) return <Loading label="Loading your order…" className="p-12" />;
  if (order === null) return <Alert tone="bad">We could not find that order. <Link to="/my-orders">Go to My orders</Link></Alert>;
  const st = STATUS[order.status] || STATUS.pending;
  const hasFee = order.shipping_fee_php != null;
  return (
    <div className="space-y-4">
      {placed && <Alert tone="ok"><span><strong>Thank you! Your order was placed.</strong> Keep your order number: {order.order_number}.</span></Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-3xl"><IconPackage />Order {order.order_number}</h1>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <p className="text-ink-muted">Placed {fmtDateTime(order.created_at)}. {nextText(order)}</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="card p-4" aria-labelledby="items-h">
          <h2 id="items-h" className="mb-2 text-lg font-black">Items</h2>
          <ul className="divide-y divide-brand-sky">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2"><span className="min-w-0"><span className="block text-sm text-ink-muted">{i.artist}</span><span className="break-words font-bold">{i.title}</span></span><span className="tabular-nums">{peso(i.unit_price_php)} × {i.quantity}</span></li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-brand-sky pt-3 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd className="tabular-nums">{peso(order.subtotal_php)}</dd></div>
            {hasFee ? (
              <div className="flex flex-wrap justify-between gap-x-4"><dt>Shipping fee (paid separately)</dt><dd className="text-right"><span className="tabular-nums">{Number(order.shipping_fee_php) > 0 ? peso(order.shipping_fee_php) : "Free"}</span> <Badge tone={SHIPPING[order.shipping_status].tone}>{SHIPPING[order.shipping_status].label}</Badge></dd></div>
            ) : order.shipping_status === "none" ? (
              <div className="flex justify-between gap-4"><dt>Shipping fee</dt><dd className="text-right">Set after your payment is confirmed</dd></div>
            ) : (
              <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">{Number(order.shipping_php) > 0 ? peso(order.shipping_php) : "Free"}</dd></div>
            )}
            <div className="flex justify-between text-base font-black"><dt>Total paid (GCash)</dt><dd className="tabular-nums">{peso(order.total_php)}</dd></div>
          </dl>
        </section>
        <section className="card space-y-3 p-4 text-sm" aria-labelledby="ship-h">
          <h2 id="ship-h" className="text-lg font-black">Delivery</h2>
          <p><strong>{order.name}</strong><br />{order.address}<br />{order.city} {order.postal_code}<br />{order.phone}<br />{order.email}</p>
          {order.notes && <p><span className="font-semibold">Your note:</span> {order.notes}</p>}
          <p className="flex items-center gap-1 text-ink-muted"><IconCheck />GCash reference {order.reference_number}</p>
        </section>
      </div>
      {order.status === "paid" && order.shipping_status === "awaiting_payment" && <ShippingPayment order={order} onSent={() => setReload((n) => n + 1)} />}
      <p><Link to="/my-orders">All my orders</Link> · <Link to="/shop">Back to the shop</Link></p>
    </div>
  );
}
