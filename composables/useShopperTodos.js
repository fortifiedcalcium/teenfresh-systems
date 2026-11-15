import { supabase } from "~/lib/supabaseClient.js";
import { allTodos } from "~/lib/orderTodos.js";

const FIELDS = "id,order_number,status,shipping_status,shipping_fee_php,shipping_note,balance_status,balance_for,balance_due_php,balance_note,preferred_courier";

// Which to-dos this shopper has already looked at, kept in this browser: a list of to-do keys.
const seenKey = (uid) => `shopper_todos_seen:${uid}`;
const readSeen = (uid) => { try { const v = JSON.parse(localStorage.getItem(seenKey(uid)) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); } };
const writeSeen = (uid, set) => { try { localStorage.setItem(seenKey(uid), JSON.stringify([...set])); } catch { /* private mode: it lasts until the page closes */ } };

/** What the signed-in shopper still has to do on their orders, live, and which of it is NEW to them.
 *  `userId` and `enabled` may be refs. `onNew(todos)` is called when a new to-do appears (never on the first reading), so the page can say so.
 *  Looking at the list (markAllSeen) or at an order (markOrderSeen) clears the counter until something new arrives.
 *  Returns { todos (ref, null until the first reading), unseen (ref: how many required to-dos are new), markAllSeen, markOrderSeen }. */
export function useShopperTodos(userId, enabled, onNew) {
  const todos = ref(null);
  const seen = ref(new Set());
  let known = null;

  const load = async () => {
    const uid = unref(userId);
    const { data, error } = await supabase.from("orders").select(FIELDS).eq("user_id", uid);
    if (error || uid !== unref(userId)) return;                           // a failed refresh keeps what we have
    const next = allTodos(data || []);
    const fresh = known ? next.filter((t) => t.required && !known.has(t.key)) : [];
    known = new Set(next.map((t) => t.key));
    todos.value = next;
    // what the shopper dealt with is forgotten, so the same thing coming back later counts as new again
    const kept = new Set([...seen.value].filter((k) => known.has(k)));
    if (kept.size !== seen.value.size) { writeSeen(uid, kept); seen.value = kept; }
    if (fresh.length) onNew?.(fresh);
  };
  const on = computed(() => Boolean(unref(enabled) && unref(userId)));
  watch(() => [on.value, unref(userId)], ([isOn, uid]) => { known = null; todos.value = null; seen.value = uid ? readSeen(uid) : new Set(); if (isOn) load(); }, { immediate: true });
  useLiveReload("orders", load, { enabled: on, filter: computed(() => `user_id=eq.${unref(userId)}`) });

  const mark = (keys) => { if (!keys.length) return; const n = new Set([...seen.value, ...keys]); writeSeen(unref(userId), n); seen.value = n; };
  const markAllSeen = () => mark((todos.value || []).map((t) => t.key));
  const markOrderSeen = (orderId) => mark((todos.value || []).filter((t) => t.orderId === orderId).map((t) => t.key));
  const unseen = computed(() => (todos.value || []).filter((t) => t.required && !seen.value.has(t.key)).length);

  return { todos, unseen, markAllSeen, markOrderSeen };
}
