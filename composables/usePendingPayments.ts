import { supabase } from "~/lib/supabaseClient";

/** Number of payments waiting for an admin (status "pending"), live: a Realtime subscription on payments triggers a
 *  re-count, throttled to one query per second. Falls back to 0 if the count cannot be read. Returns a ref. */
export function usePendingPayments(enabled = true, throttleMs = 1000) {
  const count = ref(0);
  if (!enabled) return count;
  let timer = null; let last = 0; let alive = true;
  const run = async () => {
    last = Date.now();
    const { count: n, error } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (alive) count.value = error ? 0 : n || 0;
  };
  const schedule = () => {
    if (timer) return;                       // one refresh is already queued
    timer = setTimeout(() => { timer = null; run(); }, Math.max(0, throttleMs - (Date.now() - last)));
  };
  run();
  const ch = supabase.channel("admin-pending-payments").on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule).subscribe();
  onScopeDispose(() => { alive = false; clearTimeout(timer); timer = null; supabase.removeChannel(ch); });
  return count;
}
