<script setup lang="ts">
import type { PropType } from "vue";
import { SIDEBAR_GROUPS, isGroupActive } from "~/lib/adminNav";
import logo from "~/assets/logo/teenfresh-logo.png";

// Desktop navigation (1024px and up): 240px (260px at 1536+), collapsible to an icon rail. Hidden below 1024px
// with display:none, so it is not in the accessibility tree while the bottom bar is. `notes` is { counts, unread, onRead, onReadAll }.
defineProps({ email: String, pending: { type: Number, default: 0 }, notes: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, default: () => ({}) } });
const emit = defineEmits(["signOut"]);
// Related pages share one item (see GROUPS in lib/adminNav); the pages inside a group are a pill switch under each page title.
// The scanner also has its own button at the bottom (the one thing an admin reaches for at the door).
const route = useRoute();
const KEY = "admin_sidebar_collapsed";
const collapsed = ref(false);
onMounted(() => { try { collapsed.value = localStorage.getItem(KEY) === "1"; } catch { /* ignore */ } });
function toggle() { collapsed.value = !collapsed.value; try { localStorage.setItem(KEY, collapsed.value ? "1" : "0"); } catch { /* ignore */ } }
</script>

<template>
  <aside id="admin-nav" aria-label="Admin sidebar" :data-collapsed="collapsed" :class="['on-ink admin-side hidden shrink-0 p-4 lg:block', collapsed ? 'lg:w-[84px]' : 'lg:w-60 2xl:w-[260px]']">
    <div class="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto">
      <div class="mb-3 flex items-center justify-between gap-1 px-1">
        <span v-if="collapsed" class="sr-only">Admin</span>
        <div v-else class="flex items-center gap-2.5"><span class="admin-side__logo"><img :src="logo" alt="Teenfresh" width="141" height="30" class="h-[30px] w-auto"></span><p class="text-sm font-extrabold">Admin</p></div>
        <button type="button" class="btn-secondary min-w-target px-2" :aria-expanded="!collapsed" aria-controls="admin-nav-list" @click="toggle">
          <IconChevronRight v-if="collapsed" /><IconChevronLeft v-else /><span class="sr-only">{{ collapsed ? "Expand sidebar" : "Collapse sidebar" }}</span>
        </button>
      </div>
      <div :class="['mb-3 flex', collapsed ? 'justify-center' : 'px-1']"><NotificationBell :counts="notes.counts" :unread="notes.unread" align="left" :icon-only="collapsed" @read="notes.onRead" @read-all="notes.onReadAll" /></div>
      <nav aria-label="Admin">
        <ul id="admin-nav-list" class="space-y-1">
          <li v-for="g in SIDEBAR_GROUPS" :key="g.key">
            <NuxtLink :to="g.pages[0][0]" :exact="g.end" :aria-current="isGroupActive(g, route.path) ? 'page' : undefined" :class="['nav-link flex w-full', collapsed ? 'justify-center px-0' : '']" :title="collapsed ? g.label : undefined">
              <component :is="g.icon" /><span :class="collapsed ? 'sr-only' : ''">{{ g.label }}</span>
              <span v-if="g.badge === 'pending' && pending > 0" class="ml-auto rounded-full bg-brand-coral px-2 text-xs font-extrabold text-ink"><span aria-hidden="true">{{ pending > 99 ? "99+" : pending }}</span><span class="sr-only"> {{ pending }} payments pending verification</span></span>
            </NuxtLink>
          </li>
        </ul>
      </nav>
      <NuxtLink to="/admin/scanner" :class="['btn-primary mt-auto', collapsed ? 'justify-center px-0' : 'justify-start']" :title="collapsed ? 'Scan tickets' : undefined"><IconScan /><span :class="collapsed ? 'sr-only' : ''">Scan tickets</span></NuxtLink>
      <div class="mt-4 space-y-1 border-t admin-side__rule pt-4 text-sm">
        <p v-if="!collapsed" class="truncate px-2 admin-side__muted">{{ email }}</p>
        <NuxtLink to="/" :class="['nav-link flex w-full', collapsed ? 'justify-center px-0' : '']"><IconArrowLeft /><span :class="collapsed ? 'sr-only' : ''">Attendee site</span></NuxtLink>
        <button type="button" :class="['nav-link flex w-full text-left', collapsed ? 'justify-center px-0' : '']" @click="emit('signOut')"><IconLogOut /><span :class="collapsed ? 'sr-only' : ''">Sign out</span></button>
      </div>
    </div>
  </aside>
</template>
