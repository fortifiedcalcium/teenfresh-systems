import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { STATUS } from "../../lib/orders.js";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconPackage } from "../../components/NavIcons.jsx";

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError("We could not load your orders. Check your connection and refresh the page.");
      setOrders(data || []);
    });
    return () => { alive = false; };
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-3xl"><IconPackage />My orders</h1>
      {error && <Alert tone="bad">{error}</Alert>}
      {orders === null ? <Loading label="Loading your orders…" className="p-12" />
        : orders.length === 0 ? <Empty>You have not placed an order yet. <Link to="/shop">Browse the shop</Link></Empty>
        : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const st = STATUS[o.status] || STATUS.pending;
              return (
                <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <h2 className="font-black">Order {o.order_number}</h2>
                    <p className="text-sm text-ink-muted">{fmtDateTime(o.created_at)} · {peso(o.total_php)}</p>
                  </div>
                  <div className="flex items-center gap-3"><Badge tone={st.tone}>{st.label}</Badge><Link to={`/orders/${o.id}`}>View order{" "}<span className="sr-only">{o.order_number}</span></Link></div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
