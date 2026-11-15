import { MAX_QTY } from "~/lib/orders.js";
import { lineKey } from "~/lib/cartLine.js";

// The cart holds only product ids, the chosen variation (if the product has any) and quantities. Names and prices are read from the database each
// time the cart is shown, and place_order() prices the order itself, so an old cart can never keep an old price.
const KEY = "teenfresh-cart";
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty >= 1 && (i.vid === undefined || i.vid === null || typeof i.vid === "string")).slice(0, 20) : []; } catch { return []; } };

const items = ref([]);
let started = false;
/** Loads the saved cart and keeps it saved (called once, from plugins/cart.client.js). */
export function startCart() {
  if (started) return;
  started = true;
  items.value = read();
  watch(items, (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: the cart lasts until the page closes */ } }, { deep: true });
}

export function useCart() {
  // add(productId, variationId?) puts one in; setQty / remove take the line key (see lineKey)
  const add = (id, vid = null) => {
    const k = lineKey({ id, vid });
    items.value = items.value.some((i) => lineKey(i) === k)
      ? items.value.map((i) => (lineKey(i) === k ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) } : i))
      : [...items.value, { id, ...(vid ? { vid } : {}), qty: 1 }];
  };
  const setQty = (key, qty) => { items.value = items.value.map((i) => (lineKey(i) === key ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i)); };
  const remove = (key) => { items.value = items.value.filter((i) => lineKey(i) !== key); };
  const clear = () => { items.value = []; };
  return { items, count: computed(() => items.value.reduce((a, i) => a + i.qty, 0)), add, setQty, remove, clear };
}

/** Cart lines joined with the live products and variations (refs). Each line is the product with `key`, `quantity`, `variation` (or null) and `price` (the
 *  variation's price, else the product's). `gone` are line keys whose product or chosen version was hidden or deleted, or that now need a version chosen. */
export function useCartLines(products, variations) {
  const { items: cart } = useCart();
  return computed(() => {
    const prods = unref(products);
    const vars = unref(variations) || {};
    if (!prods) return { lines: [], gone: [] };
    const byId = Object.fromEntries(prods.map((p) => [p.id, p]));
    const lines = []; const gone = [];
    for (const i of cart.value) {
      const p = byId[i.id];
      const options = vars[i.id] || [];
      const v = i.vid ? options.find((o) => o.id === i.vid) : null;
      if (!p || (i.vid && !v) || (!i.vid && options.length > 0)) { gone.push(lineKey(i)); continue; }
      lines.push({ ...p, key: lineKey(i), vid: i.vid || null, variation: v || null, price: v?.price ?? p.price, stock: v?.stock ?? null, quantity: i.qty });
      // (stock: how many are left, or null when they are not counted)
    }
    return { lines, gone };
  });
}
