<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { playChime, unlockChime } from "~/lib/chime.js";
import { typesForLocation } from "~/lib/notifications.js";

// Admin frame. Below 1024px: sticky top bar + bottom navigation (raised scan button). From 1024px: the sidebar.
// The switch is pure CSS (lg:), so there is no user-agent sniffing and the hidden navigation is display:none.
// Loads the events once and shares the selected one with every admin page through useAdminContext().
// The shop has nothing to do with events, so its pages do not show the event picker: Shop products, and the "shop" tab of Payments and Email.
const SHOP_PAGES = ["/admin/products"];
const HUB_PAGES = ["/admin/payments", "/admin/emails"];

const { profile, signOut } = useAuth();
const route = useRoute();
const toast = useToast();
const { event } = useAdminContext();
const onShopPage = computed(() => SHOP_PAGES.some((p) => route.path === p || route.path.startsWith(p + "/")) || (HUB_PAGES.includes(route.path) && route.query.tab === "shop"));
adminEvents.value = null;
try { adminEventId.value = localStorage.getItem("admin_event") || ""; } catch { adminEventId.value = ""; }
const pendingCount = usePendingPayments(true);
watch(pendingCount, (n) => { adminPending.value = n; }, { immediate: true });
// something new is waiting for an admin: say so, wherever they are in the admin area
const { counts, unread, markRead, markAllRead } = useAdminNotifications(true, (types) => { types.forEach((t) => toast(t.toast, "info")); playChime(); }, { userId: computed(() => profile.value?.id) });
const notes = computed(() => ({ counts: counts.value, unread: unread.value, onRead: markRead, onReadAll: markAllRead }));
let stopUnlock = () => {};
onMounted(() => { stopUnlock = unlockChime() || (() => {}); });   // the browser allows sound after the first click or key press
onBeforeUnmount(() => stopUnlock());
// Looking at the page a notification leads to counts as reading it (once, when the page opens: not while it sits open and new ones arrive).
watch([() => route.path, () => route.query.tab, () => counts.value !== null], ([, , loaded]) => {
  if (loaded) markRead(typesForLocation(route.path, route.query.tab ? `?tab=${route.query.tab}` : ""));
}, { immediate: true });
const keyboardOpen = useKeyboardOpen();

async function reload() {
  const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
  adminEvents.value = data || [];
}
setAdminReloader(reload);
onMounted(reload);

// Keep each tab's scroll position: remember it when leaving a page, restore it when coming back.
const scrolls = {};
let prev = route.path;
watch(() => route.path, (p) => {
  scrolls[prev] = window.scrollY;
  prev = p;
  const y = scrolls[p] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
});

function select(id) { adminEventId.value = id; try { localStorage.setItem("admin_event", id); } catch { /* ignore */ } }
</script>

<template>
  <div class="min-h-[100vh] min-h-dvh lg:flex">
    <SkipLink />
    <AdminSidebar :email="profile?.email" :pending="adminPending" :notes="notes" @sign-out="signOut" />
    <div class="min-w-0 flex-1">
      <AdminTopBar :notes="notes" />
      <section v-if="!onShopPage" aria-label="Event selection" class="flex flex-wrap items-center gap-2 border-b border-link bg-brand-cream px-4 py-3">
        <label for="event-select" class="text-sm font-semibold">Event</label>
        <select id="event-select" class="input max-w-md" :value="event?.id || ''" :disabled="!adminEvents?.length" @change="select($event.target.value)">
          <option v-for="e in adminEvents" :key="e.id" :value="e.id">{{ e.title }}</option>
          <option v-if="adminEvents && !adminEvents.length">No events yet</option>
        </select>
      </section>
      <main id="main-content" tabindex="-1" class="admin-main" :data-nav-hidden="keyboardOpen">
        <div class="admin-page">
          <Loading v-if="adminEvents === null" label="Loading events…" />
          <slot v-else />
        </div>
      </main>
    </div>
    <AdminBottomNav :pending="adminPending" :hidden="keyboardOpen" />
  </div>
</template>
