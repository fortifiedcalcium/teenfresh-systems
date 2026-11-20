import { defineStore } from "pinia";
import { MAX_QTY } from "~/lib/orders";
import { lineKey } from "~/lib/cartLine";

// The cart holds only product ids, the chosen variation (if the product has any) and quantities. Names and prices are read from the database each
// time the cart is shown, and place_order() prices the order itself, so an old cart can never keep an old price.
export interface CartItem { id: string; vid?: string | null; qty: number }
const PREFIX = "teenfresh-cart";
// Each signed-in account gets its own saved cart, and signed-out visitors share a separate "guest" one. Without this, a shared
// computer (or simply switching accounts in the same browser) would show one person's cart, and let them place the next person's order.
const keyFor = (uid?: string | null) => `${PREFIX}:${uid || "guest"}`;
const read = (key: string): CartItem[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.qty) && i.qty >= 1 && (i.vid === undefined || i.vid === null || typeof i.vid === "string")).slice(0, 20) : [];
  } catch { return []; }
};

export const useCartStore = defineStore("cart", () => {
  const items = ref<CartItem[]>([]);
  const count = computed(() => items.value.reduce((a, i) => a + i.qty, 0));
  let storageKey = keyFor(null);
  let started = false;
  /** Loads the saved cart and keeps it saved, and switches to the right account's cart as sign-in state changes.
   *  Runs once, from plugins/cart.client.ts. */
  function init() {
    if (started) return;
    started = true;
    const { user } = useAuth();
    storageKey = keyFor(user.value?.id);
    items.value = read(storageKey);
    watch(items, (v) => { try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* private mode: the cart lasts until the page closes */ } }, { deep: true });
    watch(() => user.value?.id, (uid) => loadFor(uid));
  }
  /** Switches to the cart saved under this user (or the guest cart, signed out). */
  function loadFor(uid?: string | null) {
    const key = keyFor(uid);
    if (key === storageKey) return;
    storageKey = key;
    items.value = read(storageKey);
  }
  // add(productId, variationId?) puts one in; setQty / remove take the line key (see lineKey)
  function add(id: string, vid: string | null = null) {
    const k = lineKey({ id, vid });
    items.value = items.value.some((i) => lineKey(i) === k)
      ? items.value.map((i) => (lineKey(i) === k ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) } : i))
      : [...items.value, { id, ...(vid ? { vid } : {}), qty: 1 }];
  }
  const setQty = (key: string, qty: number) => { items.value = items.value.map((i) => (lineKey(i) === key ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i)); };
  const remove = (key: string) => { items.value = items.value.filter((i) => lineKey(i) !== key); };
  const clear = () => { items.value = []; };
  return { items, count, init, add, setQty, remove, clear };
});
