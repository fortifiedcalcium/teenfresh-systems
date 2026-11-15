import { SHOP_ENABLED } from "~/lib/features";

// The shop pages only exist while the shop is on (VITE_SHOP_ENABLED).
export default defineNuxtRouteMiddleware(() => { if (!SHOP_ENABLED) return navigateTo("/", { replace: true }); });
