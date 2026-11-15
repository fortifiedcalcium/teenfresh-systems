/** What can need an admin's attention, in the order the bell lists it. `toast` is the message when a NEW one arrives while the
 *  admin is on the site (null = the admin caused it themselves, for example by confirming a payment, so no toast). */
export const NOTE_TYPES = [
  { key: "event_payments", label: "Event payments to review", to: "/admin/payments", toast: "A new event payment is waiting for review" },
  { key: "order_payments", label: "Shop orders to check", to: "/admin/payments?tab=shop", toast: "A new shop order is waiting for a payment check", shop: true },
  { key: "extra_payments", label: "Extra payments to check", to: "/admin/payments?tab=shop", toast: "A shopper sent an extra payment to check", shop: true },
  { key: "shipping_payments", label: "Shipping fee payments to check", to: "/admin/payments?tab=shop", toast: "A shipping fee payment is waiting to be checked", shop: true },
  { key: "set_fee", label: "Orders waiting for a shipping fee", to: "/admin/payments?tab=shop", toast: null, shop: true },
  { key: "ready_to_ship", label: "Orders ready to ship", to: "/admin/payments?tab=shop", toast: null, shop: true },
];

/** The types whose count went up between two readings (and so deserve a toast). Nothing before the first reading. */
export function arrivals(prev, next) {
  if (!prev) return [];
  return NOTE_TYPES.filter((t) => t.toast && (next[t.key] || 0) > (prev[t.key] || 0));
}

/** The types an admin gets notified about (something a person sent). The others are work the admin made themselves, so they only
 *  appear in the list as "still waiting", never as new. */
export const NOTIFY_KEYS = NOTE_TYPES.filter((t) => t.toast).map((t) => t.key);

/** How many of each kind are NEW: more than the admin had already seen. */
export function unreadOf(counts, seen) {
  const out = {};
  for (const k of NOTIFY_KEYS) out[k] = Math.max(0, (counts?.[k] || 0) - (seen?.[k] || 0));
  return out;
}
export const totalUnread = (unread) => Object.values(unread || {}).reduce((a, n) => a + n, 0);

/** Seen can never be above what is waiting now (the admin dealt with some), or the next arrival would go unnoticed. */
export function reconcileSeen(seen, counts) {
  const out = {};
  for (const k of NOTIFY_KEYS) out[k] = Math.min(seen?.[k] || 0, counts?.[k] || 0);
  return out;
}

/** Which kinds of notification belong to the page the admin is looking at (so viewing it counts as reading them). */
export function typesForLocation(pathname, search) {
  const tab = new URLSearchParams(search).get("tab");
  return NOTE_TYPES.filter((t) => t.toast).filter((t) => {
    const u = new URL(t.to, "http://x");
    return u.pathname === pathname && (u.searchParams.get("tab") || null) === (tab || null);
  }).map((t) => t.key);
}

/** The list the bell shows: only the types with something waiting, with their counts. */
export const pendingNotes = (counts) => NOTE_TYPES.map((t) => ({ ...t, count: counts?.[t.key] || 0 })).filter((t) => t.count > 0);
/** The number on the bell: everything that is waiting. */
export const totalNeeding = (counts) => pendingNotes(counts).reduce((a, t) => a + t.count, 0);
