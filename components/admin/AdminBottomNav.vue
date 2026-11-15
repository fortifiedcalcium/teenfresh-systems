<script setup lang="ts">
import { matchers, TABS } from "~/lib/adminNav";

// Five slots: Home, Search, [Scan], History, Profile. Rendered below 1024px (lg:hidden is display:none, so the hidden bar
// is out of the accessibility tree and the tab order). hidden: keyboard open.
const props = defineProps({ pending: { type: Number, default: 0 }, hidden: Boolean });
const route = useRoute();
const docked = computed(() => matchers.scan(route.path));
const live = ref("");
// announce a changed pending count politely, but not the first value
watch(() => props.pending, (n) => { live.value = `${n} payment${n === 1 ? "" : "s"} pending verification`; });

/** Scroll to the top and put focus on the page heading, like tapping the active tab in a native app. */
function scrollTopAndFocus() {
  window.scrollTo({ top: 0, behavior: "auto" });
  const h = document.querySelector("#main-content h1");
  if (h) { h.setAttribute("tabindex", "-1"); (h as HTMLElement).focus({ preventScroll: true }); }
}
</script>

<template>
  <nav aria-label="Admin" class="admin-bottom-nav lg:hidden" :data-docked="docked" :data-hidden="hidden">
    <div class="admin-bottom-nav__shadow" aria-hidden="true"><div class="admin-bottom-nav__bg" /></div>
    <ul class="admin-bottom-nav__list">
      <template v-for="t in TABS" :key="t.key">
        <ScanFab v-if="t.fab" :to="t.to" :label="t.label" :active="matchers[t.key](route.path)" @active-click="scrollTopAndFocus" />
        <BottomNavItem v-else :to="t.to" :label="t.label" :icon="t.icon" :active="matchers[t.key](route.path)" :badge="t.key === 'profile' ? pending : 0" :badge-label="`${pending} payment${pending === 1 ? '' : 's'} pending verification`" @active-click="scrollTopAndFocus" />
      </template>
    </ul>
    <span class="sr-only" role="status" aria-live="polite">{{ live }}</span>
  </nav>
</template>
