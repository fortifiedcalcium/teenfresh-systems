import { whenAuthReady } from "~/composables/useAuth.js";

/** Signed-in users only. Visitors are sent to /login and come back here afterwards. */
export default defineNuxtRouteMiddleware(async (to) => {
  await whenAuthReady();
  const { user } = useAuth();
  if (!user.value) return navigateTo({ path: "/login", query: { from: to.fullPath } }, { replace: true });
});
