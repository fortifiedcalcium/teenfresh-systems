import { lineKey } from "~/lib/cartLine";

/** The pages use useCart(); the state itself lives in the Pinia store (stores/cart.ts). */
export function useCart() {
  const s = useCartStore();
  const { items, count } = storeToRefs(s);
  return { items, count, add: s.add, setQty: s.setQty, remove: s.remove, clear: s.clear };
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
