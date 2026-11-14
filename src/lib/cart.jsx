import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MAX_QTY } from "./orders.js";

// The cart holds only product ids, the chosen variation (if the product has any) and quantities. Names and prices are read from the database each
// time the cart is shown, and place_order() prices the order itself, so an old cart can never keep an old price.
const KEY = "teenfresh-cart";
/** The line a cart item is: the same product in two versions is two lines. */
export const lineKey = (i) => (i.vid ? `${i.id}:${i.vid}` : i.id);
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty >= 1 && (i.vid === undefined || i.vid === null || typeof i.vid === "string")).slice(0, 20) : []; } catch { return []; } };

const empty = { items: [], count: 0, add() {}, setQty() {}, remove() {}, clear() {} };   // pages still render without a provider (tests)
const CartContext = createContext(empty);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [items, setItems] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: the cart lasts until the page closes */ } }, [items]);
  // add(productId, variationId?) puts one in; setQty / remove take the line key (see lineKey)
  const add = useCallback((id, vid = null) => setItems((cur) => {
    const k = lineKey({ id, vid });
    return cur.some((i) => lineKey(i) === k) ? cur.map((i) => (lineKey(i) === k ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) } : i)) : [...cur, { id, ...(vid ? { vid } : {}), qty: 1 }];
  }), []);
  const setQty = useCallback((key, qty) => setItems((cur) => cur.map((i) => (lineKey(i) === key ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))), []);
  const remove = useCallback((key) => setItems((cur) => cur.filter((i) => lineKey(i) !== key)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, count: items.reduce((a, i) => a + i.qty, 0), add, setQty, remove, clear }), [items, add, setQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Cart lines joined with the live products and variations. Each line is the product with `key`, `quantity`, `variation` (or null) and `price` (the
 *  variation's price, else the product's). `gone` are line keys whose product or chosen version was hidden or deleted, or that now need a version chosen. */
export function useCartLines(products, variations = {}) {
  const { items } = useCart();
  return useMemo(() => {
    if (!products) return { lines: [], gone: [] };
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    const lines = []; const gone = [];
    for (const i of items) {
      const p = byId[i.id];
      const options = variations[i.id] || [];
      const v = i.vid ? options.find((o) => o.id === i.vid) : null;
      if (!p || (i.vid && !v) || (!i.vid && options.length > 0)) { gone.push(lineKey(i)); continue; }
      lines.push({ ...p, key: lineKey(i), vid: i.vid || null, variation: v || null, price: v?.price ?? p.price, quantity: i.qty });
    }
    return { lines, gone };
  }, [items, products, variations]);
}
