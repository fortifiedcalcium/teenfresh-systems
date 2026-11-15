import { supabase } from "~/lib/supabaseClient.js";
import { SHOP_ENABLED } from "~/lib/features.js";
import { NOTE_TYPES, NOTIFY_KEYS, arrivals, reconcileSeen, unreadOf } from "~/lib/notifications.js";

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

// What each admin has already seen, kept in this browser (one entry per admin): { kind: how many were waiting when they looked }.
const seenKey = (uid) => `admin_notes_seen:${uid || "admin"}`;
const readSeen = (uid) => { try { const v = JSON.parse(localStorage.getItem(seenKey(uid)) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const writeSeen = (uid, v) => { try { localStorage.setItem(seenKey(uid), JSON.stringify(v)); } catch { /* private mode: it lasts until the page closes */ } };

/** What is waiting for an admin, live: a Realtime change on payments or orders triggers a re-count (one at a time, at most once a
 *  second), and a slow poll catches anything Realtime misses. `onNew(types)` is called when something NEW arrives, never on the first reading.
 *  Also remembers what the admin has seen (in this browser), so only NEW arrivals count as unread: markRead(kinds) after they open or
 *  view something, markAllRead() for everything. `userId` may be a ref (the profile loads after the layout).
 *  Returns { counts, unread, markRead, markAllRead } (counts is a ref that is null until the first reading). */
export function useAdminNotifications(enabled, onNew, { throttleMs = 1000, pollMs = 60000, userId = null } = {}) {
  const counts = ref(null);
  const seen = ref(readSeen(unref(userId)));
  let current = null;
  let prev = null;
  let stop = () => {};

  const start = (uid) => {
    stop();
    seen.value = readSeen(uid);
    prev = null; current = null; counts.value = null;
    let alive = true; let timer = null; let last = 0;
    const run = async () => {
      last = Date.now();
      const keys = NOTE_TYPES.filter((t) => SHOP_ENABLED || !t.shop).map((t) => t.key);        // no shop counts when the shop is off
      const results = await Promise.all(keys.map(async (k) => { const { count: n, error } = await count(...QUERIES[k]); return [k, error ? null : n || 0]; }));
      if (!alive) return;
      const next = { ...(prev || {}) };
      for (const [k, n] of results) if (n !== null) next[k] = n;          // a count that failed keeps its last value
      const fresh = arrivals(prev, next);
      prev = next; current = next; counts.value = next;
      const c = reconcileSeen(seen.value, next); writeSeen(uid, c); seen.value = c;      // what was dealt with is no longer "seen"
      if (fresh.length) onNew?.(fresh);
    };
    const schedule = () => {
      if (timer) return;                                          // one refresh is already queued
      timer = setTimeout(() => { timer = null; run(); }, Math.max(0, throttleMs - (Date.now() - last)));
    };
    run();
    const ch = supabase.channel("admin-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
      .subscribe();
    const poll = setInterval(schedule, pollMs);
    stop = () => { alive = false; clearTimeout(timer); timer = null; clearInterval(poll); supabase.removeChannel(ch); stop = () => {}; };
  };
  if (enabled) watch(() => unref(userId), (uid) => start(uid), { immediate: true });
  onScopeDispose(() => stop());

  const markRead = (kinds) => {
    const c = current;
    if (!c || !kinds?.length) return;
    const n = { ...seen.value };
    for (const k of kinds) if (NOTIFY_KEYS.includes(k)) n[k] = c[k] || 0;
    writeSeen(unref(userId), n); seen.value = n;
  };
  const markAllRead = () => markRead(NOTIFY_KEYS);
  const unread = computed(() => unreadOf(counts.value, seen.value));

  return { counts, unread, markRead, markAllRead };
}
