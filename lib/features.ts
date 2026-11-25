/** The shop (products, cart, checkout, orders) is on. To hide it again, build with VITE_SHOP_ENABLED=false
 *  (for example `VITE_SHOP_ENABLED=false npm run deploy`). */
export const SHOP_ENABLED = import.meta.env.VITE_SHOP_ENABLED !== "false";

/** The decorative card beside the sign-in and sign-up forms (the next event's poster and "Your tickets, all in one place.") is off for now.
 *  Set this to true to bring it back. */
export const AUTH_DECOR_ENABLED: boolean = false;
