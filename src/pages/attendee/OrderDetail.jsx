import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLiveReload } from "../../hooks/useLiveReload.js";
import { SHIPPING } from "../../lib/orders.js";
import ShippingPayment from "../../components/ShippingPayment.jsx";
import CopyButton from "../../components/CopyButton.jsx";
import CourierChoice from "../../components/CourierChoice.jsx";
import BalancePayment from "../../components/BalancePayment.jsx";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import OrderStatusBadge from "../../components/OrderStatusBadge.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { IconArrowLeft, IconCheck, IconPackage } from "../../components/NavIcons.jsx";

export const NEXT = {
  pending: "We are checking your GCash payment. This takes 48 to 72 hours. We will update this page when it is confirmed.",
  paid: "Your payment is confirmed. We are preparing your order for shipping.",   // the shipping step below adds to this
  shipped: "Your order is on its way.",
  cancelled: "This order was cancelled.",
};

/** One order: used right after checkout (with a thank-you banner) and from My orders. Only the owner and admins can open it (RLS). */
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

export default function OrderDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const placed = useLocation().state?.placed;
  const [order, setOrder] = useState(undefined);       // undefined loading, null not found
  const [items, setItems] = useState([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      // Only MY order: admins can read every order in the database, so ask for mine explicitly. Someone else's order reads as "not found".
      const o = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      const it = o.data ? await supabase.from("order_items").select("*").eq("order_id", id).order("title") : { data: [] };
      if (!alive) return;
      // a background refresh that fails keeps what is on screen; only the first load may say "not found"
      setOrder((cur) => (o.error && cur ? cur : o.data || null)); setItems((cur) => (it.error ? cur : it.data || []));
    })();
    return () => { alive = false; };
  }, [id, reload, user.id]);
  useLiveReload("orders", () => setReload((n) => n + 1), { filter: `user_id=eq.${user.id}` });       // the status, the shipping fee, the tracking number: no browser refresh needed

  if (order === undefined) return <Loading label="Loading your order…" className="p-12" />;
  if (order === null) return <Alert tone="bad">We could not find that order. <Link to="/my-orders">Go to My orders</Link></Alert>;
  const hasFee = order.shipping_fee_php != null;
  const shippingStage = order.status === "paid" && (order.shipping_status === "awaiting_payment" || order.shipping_status === "pending_review");   // the shipping fee is the only thing left to pay
  return (
    <div className="space-y-4">
      {placed && <Alert tone="ok"><span><strong>Thank you! Your order was placed.</strong> Keep your order number: {order.order_number}.</span></Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-3xl"><IconPackage />Order {order.order_number}</h1>
        <OrderStatusBadge order={order} />
      </div>
      <p className="text-ink-muted">Placed {fmtDateTime(order.created_at)}. {nextText(order)}</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="card p-4" aria-labelledby="items-h">
          <h2 id="items-h" className="mb-2 text-lg font-black">Items</h2>
          <ul className="divide-y divide-brand-sky">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2"><span className="min-w-0"><span className="block text-sm text-ink-muted">{i.artist}</span><span className="break-words font-bold">{i.title}</span>{i.variation_name && <span className="block text-sm font-semibold">Version: {i.variation_name}</span>}</span><span className="tabular-nums">{shippingStage ? `× ${i.quantity}` : `${peso(i.unit_price_php)} × ${i.quantity}`}</span></li>
            ))}
          </ul>
          {shippingStage ? (
            // Paying the shipping fee: show only that fee. The order itself is already paid, so its amount is left out.
            <dl className="mt-3 space-y-1 border-t border-brand-sky pt-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black">
                <dt>{order.shipping_status === "awaiting_payment" ? "Shipping fee to pay" : "Shipping fee"}</dt>
                <dd className="ml-auto flex flex-wrap items-center justify-end gap-2 text-right"><span className="tabular-nums">{peso(order.shipping_fee_php)}</span><Badge tone="warn">{order.balance_status === "awaiting_payment" && order.balance_for === "shipping" ? "Payment is short" : order.shipping_status === "awaiting_payment" ? "Awaiting payment" : SHIPPING.pending_review.label}</Badge></dd>
              </div>
              {order.balance_status && order.balance_status !== "none" && order.balance_due_php != null && (<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black "><dt>{order.balance_status === "awaiting_payment" ? "Still to pay (underpaid)" : "Extra payment being checked"}</dt><dd className="tabular-nums">{peso(order.balance_due_php)}</dd></div>)}
            </dl>
          ) : (
          <dl className="mt-3 space-y-1 border-t border-brand-sky pt-3 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd className="tabular-nums">{peso(order.subtotal_php)}</dd></div>
            {hasFee ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><dt>Shipping fee (paid separately)</dt><dd className="ml-auto text-right"><span className="tabular-nums">{Number(order.shipping_fee_php) > 0 ? peso(order.shipping_fee_php) : "Free"}</span> <Badge tone={SHIPPING[order.shipping_status].tone}>{SHIPPING[order.shipping_status].label}</Badge></dd></div>
            ) : order.shipping_status === "none" ? (
              <div className="flex justify-between gap-4"><dt>Shipping fee</dt><dd className="text-right">Set after your payment is confirmed</dd></div>
            ) : (
              <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">{Number(order.shipping_php) > 0 ? peso(order.shipping_php) : "Free"}</dd></div>
            )}
            <div className="flex justify-between text-base font-black"><dt>{order.status === "pending" ? "Total to pay (GCash)" : "Total paid (GCash)"}</dt><dd className="tabular-nums">{peso(order.total_php)}</dd></div>
            {order.balance_status && order.balance_status !== "none" && order.balance_due_php != null && (<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black "><dt>{order.balance_status === "awaiting_payment" ? "Still to pay (underpaid)" : "Extra payment being checked"}</dt><dd className="tabular-nums">{peso(order.balance_due_php)}</dd></div>)}
          </dl>
          )}
        </section>
        <section className="card space-y-3 p-4 text-sm" aria-labelledby="ship-h">
          <h2 id="ship-h" className="text-lg font-black">Delivery</h2>
          <p><strong>{order.name}</strong><br />{order.address}<br />{order.city} {order.postal_code}<br />{order.phone}<br />{order.email}</p>
          {order.notes && <p><span className="font-semibold">Your note:</span> {order.notes}</p>}
          {(order.status === "pending" || order.status === "paid") && order.shipping_status === "none" && <CourierChoice key={order.preferred_courier || "none"} order={order} onSaved={() => setReload((n) => n + 1)} />}
          {!((order.status === "pending" || order.status === "paid") && order.shipping_status === "none") && order.preferred_courier && (
            <p><span className="font-semibold">Courier:</span> {order.preferred_courier}
              {(order.status === "pending" || order.status === "paid") && <span className="block text-ink-muted">It can no longer be changed because your shipping fee is set.</span>}</p>
          )}
          {order.status === "shipped" && order.courier && (
            <div className="rounded-lg bg-brand-sky p-3">
              <p><span className="font-semibold">Courier:</span> {order.courier}</p>
              {order.tracking_number
                ? <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">Tracking number:</span> <span className="font-mono font-bold">{order.tracking_number}</span><CopyButton text={order.tracking_number} label="Copy tracking number" what="tracking number" /></p>
                : <p className="text-ink-muted">This courier did not give a tracking number.</p>}
            </div>
          )}
          <p className="flex items-center gap-1 text-ink-muted"><IconCheck />GCash reference {order.reference_number}</p>
        </section>
      </div>
      {(order.status === "pending" || order.status === "paid") && order.balance_status === "awaiting_payment" && <BalancePayment order={order} onSent={() => setReload((n) => n + 1)} />}
      {order.status === "paid" && order.shipping_status === "awaiting_payment" && order.balance_status !== "awaiting_payment" && <ShippingPayment order={order} onSent={() => setReload((n) => n + 1)} />}
      <p className="flex flex-col gap-2 sm:flex-row"><Link to="/shop" className="btn-secondary no-underline"><IconArrowLeft />Back to the shop</Link><Link to="/my-orders" className="btn-secondary no-underline"><IconPackage />All my orders</Link></p>
    </div>
  );
}
