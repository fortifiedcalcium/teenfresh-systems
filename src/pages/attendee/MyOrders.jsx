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
import { IconEye, IconPackage } from "../../components/NavIcons.jsx";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
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
