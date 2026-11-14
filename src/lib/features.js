/** The shop (products, cart, checkout, orders) is on while developing (npm run dev) and off in a normal build.
 *  To ship it, build with VITE_SHOP_ENABLED=true (for example in .env.production). */
export const SHOP_ENABLED = import.meta.env.DEV || import.meta.env.VITE_SHOP_ENABLED === "true";
