import { supabase } from "~/lib/supabaseClient";
import { DEFAULT_COURIERS } from "~/lib/orders";
import { groupVariations } from "~/lib/variations";

/** The live rows (price, name, image) for what is in the cart, with each product's versions grouped by product id. `products` is null while loading.
 *  A hidden or deleted product, or version, is missing from the result. Returns a ref of { products, variations, error }. */
export function useCartProducts() {
  const { items } = useCart();
  const state = ref({ products: null, variations: {}, error: "" });
  const key = computed(() => [...new Set(items.value.map((i) => i.id))].sort().join(","));
  let run = 0;
  watch(key, async (k) => {
    const mine = ++run;
    if (!k) { state.value = { products: [], variations: {}, error: "" }; return; }
    const ids = k.split(",");
    const [p, v] = await Promise.all([supabase.from("products").select("*").in("id", ids).eq("active", true), supabase.from("product_variations").select("*").in("product_id", ids).eq("active", true).order("position")]);
    if (mine !== run) return;
    if (p.error) { state.value = { products: [], variations: {}, error: "We could not load your cart. Check your connection and refresh the page." }; return; }
    state.value = { products: p.data || [], variations: groupVariations(v.error ? [] : v.data || []), error: "" };
  }, { immediate: true });
  onScopeDispose(() => { run++; });
  return state;
}

/** Loads once on mount into a ref that is null while loading. */
function useLoaded(load) {
  const value = ref(null);
  let alive = true;
  load().then((v) => { if (alive) value.value = v; });
  onScopeDispose(() => { alive = false; });
  return value;
}

/** The couriers an admin keeps in the list (names, in the order they were added). null while loading; the starting list if it cannot be read. */
export const useCouriers = () => useLoaded(async () => { const { data, error } = await supabase.from("couriers").select("name").order("id"); return error ? DEFAULT_COURIERS : (data || []).map((r) => r.name); });

/** The product categories (names, in the order an admin made them). null while loading. */
export const useProductCategories = () => useLoaded(async () => { const { data } = await supabase.from("product_categories").select("name").order("id"); return (data || []).map((r) => r.name); });

/** The GCash details. null while loading. */
export const useShopSettings = () => useLoaded(async () => { const { data } = await supabase.from("shop_settings").select("*").maybeSingle(); return data || {}; });
