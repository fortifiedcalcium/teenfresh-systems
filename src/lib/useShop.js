import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useCart } from "./cart.jsx";

/** The live rows (price, name, image) for what is in the cart. null while loading. A hidden or deleted product is missing from the result. */
export function useCartProducts() {
  const { items } = useCart();
  const key = items.map((i) => i.id).sort().join(",");
  const [state, setState] = useState({ products: null, error: "" });
  useEffect(() => {
    let alive = true;
    if (!key) { setState({ products: [], error: "" }); return undefined; }
    supabase.from("products").select("*").in("id", key.split(",")).eq("active", true).then(({ data, error }) => {
      if (!alive) return;
      setState(error ? { products: [], error: "We could not load your cart. Check your connection and refresh the page." } : { products: data || [], error: "" });
    });
    return () => { alive = false; };
  }, [key]);
  return state;
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
