<script setup lang="ts">
import type { PropType } from "vue";
import { titleFor } from "~/lib/adminNav";

// Slim sticky header below 1024px (the sidebar carries the context on desktop). 56px, safe-area aware.
// The title is shown here but is aria-hidden: each page keeps its own <h1> (screen-reader only on small screens), so
// there is exactly one h1 and route changes still move focus to it. `#admin-topbar-actions` receives page actions.
defineProps({ notes: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, default: () => ({}) } });
const route = useRoute();
const info = computed(() => titleFor(route.path));
</script>

<template>
  <header class="admin-surface sticky top-0 z-20 flex items-center gap-2 border-b px-3 lg:hidden" style="min-height: var(--topbar-h); padding-top: var(--safe-top)">
    <NuxtLink v-if="info.back" :to="info.back" class="btn-secondary min-w-target px-2" aria-label="Back to Profile"><IconArrowLeft /></NuxtLink>
    <p class="min-w-0 flex-1 truncate text-lg font-extrabold" aria-hidden="true">{{ info.title }}</p>
    <div id="admin-topbar-actions" class="flex items-center gap-2" />
    <NotificationBell :counts="notes.counts" :unread="notes.unread" align="right" @read="notes.onRead" @read-all="notes.onReadAll" />
  </header>
</template>
