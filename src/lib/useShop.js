import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useCart } from "./cart.jsx";
import { DEFAULT_COURIERS } from "./orders.js";

/** The live rows (price, name, image) for what is in the cart, with each product's versions grouped by product id. null while loading.
 *  A hidden or deleted product, or version, is missing from the result. */
export function useCartProducts() {
  const { items } = useCart();
  const key = [...new Set(items.map((i) => i.id))].sort().join(",");
  const [state, setState] = useState({ products: null, variations: {}, error: "" });
  useEffect(() => {
    let alive = true;
    if (!key) { setState({ products: [], variations: {}, error: "" }); return undefined; }
    const ids = key.split(",");
    Promise.all([supabase.from("products").select("*").in("id", ids).eq("active", true), supabase.from("product_variations").select("*").in("product_id", ids).eq("active", true).order("position")]).then(([p, v]) => {
      if (!alive) return;
      if (p.error) { setState({ products: [], variations: {}, error: "We could not load your cart. Check your connection and refresh the page." }); return; }
      setState({ products: p.data || [], variations: groupVariations(v.error ? [] : v.data || []), error: "" });
    });
    return () => { alive = false; };
  }, [key]);
  return state;
}

/** Versions grouped by product id, in the order the admin set. */
export function groupVariations(rows) {
  const out = {};
  for (const r of rows || []) (out[r.product_id] ||= []).push(r);
  for (const k of Object.keys(out)) out[k].sort((a, b) => (a.position - b.position) || String(a.name).localeCompare(String(b.name)));
  return out;
}

/** The couriers an admin keeps in the list (names, in the order they were added). null while loading; the starting list if it cannot be read. */
export function useCouriers() {
  const [names, setNames] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.from("couriers").select("name").order("id").then(({ data, error }) => { if (alive) setNames(error ? DEFAULT_COURIERS : (data || []).map((r) => r.name)); });
    return () => { alive = false; };
  }, []);
  return names;
}

/** The product categories (names, in the order an admin made them). null while loading. */
export function useProductCategories() {
  const [names, setNames] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.from("product_categories").select("name").order("id").then(({ data }) => { if (alive) setNames((data || []).map((r) => r.name)); });
    return () => { alive = false; };
  }, []);
  return names;
}

/** The GCash details. null while loading. */
export function useShopSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.from("shop_settings").select("*").maybeSingle().then(({ data }) => { if (alive) setSettings(data || {}); });
    return () => { alive = false; };
  }, []);
  return settings;
}
