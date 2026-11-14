import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { allTodos } from "../lib/orderTodos.js";
import { useLiveReload } from "./useLiveReload.js";

const FIELDS = "id,order_number,status,shipping_status,shipping_fee_php,shipping_note,balance_status,balance_for,balance_due_php,balance_note,preferred_courier";

/** What the signed-in shopper still has to do on their orders, live. `onNew(todos)` is called when a new to-do appears (never on the first
 *  reading), so the page can say so. Returns { todos } (null until the first reading). */
export function useShopperTodos(userId, enabled, onNew) {
  const [todos, setTodos] = useState(null);
  const known = useRef(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select(FIELDS).eq("user_id", userId);
    if (error) return;                                                    // a failed refresh keeps what we have
    const next = allTodos(data || []);
    const fresh = known.current ? next.filter((t) => t.required && !known.current.has(t.key)) : [];
    known.current = new Set(next.map((t) => t.key));
    setTodos(next);
    if (fresh.length) onNewRef.current?.(fresh);
  }, [userId]);
  useEffect(() => { if (enabled && userId) load(); }, [enabled, userId, load]);
  useLiveReload("orders", load, { enabled: Boolean(enabled && userId), filter: `user_id=eq.${userId}` });
  return { todos };
}
