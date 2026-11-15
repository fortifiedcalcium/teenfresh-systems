/** The shop (products, cart, checkout, orders) is on. To hide it again, build with VITE_SHOP_ENABLED=false
 *  (for example `VITE_SHOP_ENABLED=false npm run deploy`). */
export const SHOP_ENABLED = import.meta.env.VITE_SHOP_ENABLED !== "false";
