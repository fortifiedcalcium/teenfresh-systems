import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MAX_QTY } from "./orders.js";

// The cart holds only product ids and quantities. Names and prices are read from the database each time the cart is shown,
// and place_order() prices the order itself, so an old cart can never keep an old price.
const KEY = "teenfresh-cart";
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty >= 1).slice(0, 20) : []; } catch { return []; } };

const empty = { items: [], count: 0, add() {}, setQty() {}, remove() {}, clear() {} };   // pages still render without a provider (tests)
const CartContext = createContext(empty);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [items, setItems] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: the cart lasts until the page closes */ } }, [items]);
  const add = useCallback((id) => setItems((cur) => (cur.some((i) => i.id === id) ? cur.map((i) => (i.id === id ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) } : i)) : [...cur, { id, qty: 1 }])), []);
  const setQty = useCallback((id, qty) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))), []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, count: items.reduce((a, i) => a + i.qty, 0), add, setQty, remove, clear }), [items, add, setQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Cart lines joined with the live products. `gone` are ids whose product was hidden or deleted. */
export function useCartLines(products) {
  const { items } = useCart();
  return useMemo(() => {
    if (!products) return { lines: [], gone: [] };
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    return { lines: items.filter((i) => byId[i.id]).map((i) => ({ ...byId[i.id], quantity: i.qty })), gone: items.filter((i) => !byId[i.id]).map((i) => i.id) };
  }, [items, products]);
}
