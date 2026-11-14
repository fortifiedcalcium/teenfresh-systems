import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { allTodos } from "../lib/orderTodos.js";
import { useLiveReload } from "./useLiveReload.js";

const FIELDS = "id,order_number,status,shipping_status,shipping_fee_php,shipping_note,balance_status,balance_for,balance_due_php,balance_note,preferred_courier";

// Which to-dos this shopper has already looked at, kept in this browser: a list of to-do keys.
const seenKey = (uid) => `shopper_todos_seen:${uid}`;
const readSeen = (uid) => { try { const v = JSON.parse(localStorage.getItem(seenKey(uid)) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); } };
const writeSeen = (uid, set) => { try { localStorage.setItem(seenKey(uid), JSON.stringify([...set])); } catch { /* private mode: it lasts until the page closes */ } };

/** What the signed-in shopper still has to do on their orders, live, and which of it is NEW to them.
 *  `onNew(todos)` is called when a new to-do appears (never on the first reading), so the page can say so.
 *  Looking at the list (markAllSeen) or at an order (markOrderSeen) clears the counter until something new arrives.
 *  Returns { todos (null until the first reading), unseen (how many required to-dos are new), markAllSeen, markOrderSeen }. */
export function useShopperTodos(userId, enabled, onNew) {
  const [todos, setTodos] = useState(null);
  const [seen, setSeen] = useState(() => readSeen(userId));
  const known = useRef(null);
  const todosRef = useRef([]);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select(FIELDS).eq("user_id", userId);
    if (error) return;                                                    // a failed refresh keeps what we have
    const next = allTodos(data || []);
    const fresh = known.current ? next.filter((t) => t.required && !known.current.has(t.key)) : [];
    known.current = new Set(next.map((t) => t.key));
    todosRef.current = next;
    setTodos(next);
    // what the shopper dealt with is forgotten, so the same thing coming back later counts as new again
    setSeen((s) => { const kept = new Set([...s].filter((k) => known.current.has(k))); if (kept.size !== s.size) writeSeen(userId, kept); return kept.size === s.size ? s : kept; });
    if (fresh.length) onNewRef.current?.(fresh);
  }, [userId]);
  useEffect(() => { if (enabled && userId) load(); }, [enabled, userId, load]);
  useLiveReload("orders", load, { enabled: Boolean(enabled && userId), filter: `user_id=eq.${userId}` });

  const mark = useCallback((keys) => { if (!keys.length) return; setSeen((s) => { const n = new Set([...s, ...keys]); writeSeen(userId, n); return n; }); }, [userId]);
  const markAllSeen = useCallback(() => mark(todosRef.current.map((t) => t.key)), [mark]);
  const markOrderSeen = useCallback((orderId) => mark(todosRef.current.filter((t) => t.orderId === orderId).map((t) => t.key)), [mark]);
  const unseen = useMemo(() => (todos || []).filter((t) => t.required && !seen.has(t.key)).length, [todos, seen]);

  return { todos, unseen, markAllSeen, markOrderSeen };
}
