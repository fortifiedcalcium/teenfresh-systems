import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/** Number of payments waiting for an admin (status "pending"), live: a Realtime subscription on payments triggers a
 *  re-count, throttled to one query per second. Falls back to 0 if the count cannot be read. */
export function usePendingPayments(enabled = true, throttleMs = 1000) {
  const [count, setCount] = useState(0);
  const timer = useRef(null);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const run = async () => {
      last.current = Date.now();
      const { count: n, error } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (alive) setCount(error ? 0 : n || 0);
    };
    const schedule = () => {
      const wait = Math.max(0, throttleMs - (Date.now() - last.current));
      if (timer.current) return;                       // one refresh is already queued
      timer.current = setTimeout(() => { timer.current = null; run(); }, wait);
    };
    run();
    const ch = supabase.channel("admin-pending-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule)
      .subscribe();
    return () => { alive = false; clearTimeout(timer.current); timer.current = null; supabase.removeChannel(ch); };
  }, [enabled, throttleMs]);

  return count;
}
