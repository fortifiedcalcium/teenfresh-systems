import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLiveReload } from "../../hooks/useLiveReload.js";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import Alert from "../../components/Alert.jsx";
import OrderStatusBadge from "../../components/OrderStatusBadge.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { allTodos } from "../../lib/orderTodos.js";
import { setSoundEnabled, soundEnabled } from "../../lib/chime.js";
import { IconEye, IconPackage } from "../../components/NavIcons.jsx";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(() => soundEnabled("shopper"));
  const load = useCallback(async () => {
    // "My" orders: ask for my own rows explicitly. The database lets admins read every order (they need that in Admin), so
    // without this filter an admin saw every customer's orders on this page.
    const { data, error: err } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (err) { setError("We could not load your orders. Check your connection and refresh the page."); setOrders((o) => o ?? []); return; }
    setError(""); setOrders(data || []);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);
  useLiveReload("orders", load, { filter: `user_id=eq.${user.id}` });          // a payment confirmed, a shipment: it shows up by itself
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-3xl"><IconPackage />My orders</h1>
      {error && <Alert tone="bad">{error}</Alert>}
      {orders && orders.length > 0 && (
        <section className="card p-4" aria-labelledby="todo-h">
          <h2 id="todo-h" className="text-lg font-black">What you need to do</h2>
          {allTodos(orders).length === 0 ? <p className="mt-1 text-sm text-ink-muted">You are all set. Nothing is waiting on you right now.</p> : (
            <ul className="mt-2 divide-y divide-brand-sky">
              {allTodos(orders).map((t) => (
                <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-muted">Order {t.orderNumber}</span>
                    <span className="block font-bold">{t.text}</span>
                    {t.note && <span className="mt-0.5 block text-sm">{t.note}</span>}
                  </span>
                  <Link to={t.to} className={`${t.required ? "btn-primary" : "btn-secondary"} no-underline`}>{t.required ? "Go to order" : "Choose courier"}{" "}<span className="sr-only">{t.orderNumber}</span></Link>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-3 flex min-h-target cursor-pointer items-center gap-2 border-t border-brand-sky pt-3 text-sm">
            <input type="checkbox" role="switch" className="check" checked={sound} onChange={() => { setSound(!sound); setSoundEnabled(!sound, "shopper"); }} />
            <span>Play a sound when something new needs me</span>
          </label>
        </section>
      )}
      {orders === null ? <Loading label="Loading your orders…" className="p-12" />
        : orders.length === 0 ? <Empty>You have not placed an order yet. <Link to="/shop">Browse the shop</Link></Empty>
        : (
          <ul className="space-y-3">
            {orders.map((o) => {
              return (
                <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <h2 className="font-black">Order {o.order_number}</h2>
                    <p className="text-sm text-ink-muted">{fmtDateTime(o.created_at)} · {peso(o.total_php)}</p>
                  </div>
                  <div className="flex items-center gap-3"><OrderStatusBadge order={o} /><Link to={`/orders/${o.id}`} className="btn-secondary no-underline"><IconEye />View order{" "}<span className="sr-only">{o.order_number}</span></Link></div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
