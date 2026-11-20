// What the admin layout shares with every admin page (the React Outlet context): the events, the selected one, a reload, and the pending-payments count.
const events = ref(null);
const eventId = ref("");
const pending = ref(0);
let reloader = async () => {};

export const setAdminReloader = (fn) => { reloader = fn; };
export const adminEvents = events;
export const adminEventId = eventId;
export const adminPending = pending;

export const selectAdminEvent = (id) => { eventId.value = id; try { localStorage.setItem("admin_event", id); } catch { /* ignore */ } };

export function useAdminContext() {
  const event = computed(() => events.value?.find((e) => e.id === eventId.value) || events.value?.[0] || null);
  return { events, event, pending, reloadEvents: () => reloader() };
}
