import { whenAuthReady } from "~/composables/useAuth.js";

/** Admins only (profiles.role = 'admin'). Everyone else is redirected to /.
 *  This only hides the UI: the real protection is Row Level Security in the database. */
export default defineNuxtRouteMiddleware(async (to) => {
  await whenAuthReady();
  const { user, isAdmin } = useAuth();
  if (!user.value) return navigateTo({ path: "/login", query: { from: to.fullPath } }, { replace: true });
  if (!isAdmin.value) return navigateTo("/", { replace: true });
});
