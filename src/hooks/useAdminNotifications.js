import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { SHOP_ENABLED } from "../lib/features.js";
import { NOTE_TYPES, arrivals } from "../lib/notifications.js";

// One head-only count per kind of thing that waits for an admin.
const count = (table, filters) => {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [col, val] of filters) q = q.eq(col, val);
  return q;
};
const QUERIES = {
  event_payments: ["payments", [["status", "pending"]]],
  order_payments: ["orders", [["status", "pending"], ["balance_status", "none"]]],
  extra_payments: ["orders", [["balance_status", "pending_review"]]],
  shipping_payments: ["orders", [["shipping_status", "pending_review"]]],
  set_fee: ["orders", [["status", "paid"], ["shipping_status", "none"]]],
  ready_to_ship: ["orders", [["status", "paid"], ["shipping_status", "paid"], ["balance_status", "none"]]],
};

/** What is waiting for an admin, live: a Realtime change on payments or orders triggers a re-count (one at a time, at most once a
 *  second), and a slow poll catches anything Realtime misses. `onNew(types)` is called when something NEW arrives, never on the first reading.
 *  Returns { counts } (null until the first reading). */
export function useAdminNotifications(enabled, onNew, { throttleMs = 1000, pollMs = 60000 } = {}) {
  const [counts, setCounts] = useState(null);
  const prev = useRef(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const timer = useRef(null);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const run = async () => {
      last.current = Date.now();
      const keys = NOTE_TYPES.filter((t) => SHOP_ENABLED || !t.shop).map((t) => t.key);        // no shop counts when the shop is off
      const results = await Promise.all(keys.map(async (k) => { const { count: n, error } = await count(...QUERIES[k]); return [k, error ? null : n || 0]; }));
      if (!alive) return;
      const next = { ...(prev.current || {}) };
      for (const [k, n] of results) if (n !== null) next[k] = n;          // a count that failed keeps its last value
      const fresh = arrivals(prev.current, next);
      prev.current = next;
      setCounts(next);
      if (fresh.length) onNewRef.current?.(fresh);
    };
    const schedule = () => {
      if (timer.current) return;                                          // one refresh is already queued
      timer.current = setTimeout(() => { timer.current = null; run(); }, Math.max(0, throttleMs - (Date.now() - last.current)));
    };
    run();
    const ch = supabase.channel("admin-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
      .subscribe();
    const poll = setInterval(schedule, pollMs);
    return () => { alive = false; clearTimeout(timer.current); timer.current = null; clearInterval(poll); supabase.removeChannel(ch); };
  }, [enabled, throttleMs, pollMs]);

  return { counts };
}
