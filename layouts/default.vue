<script setup>
import logo from "~/assets/logo/teenfresh-logo.png";
import { SHOP_ENABLED } from "~/lib/features.js";
import { playChime, unlockChime } from "~/lib/chime.js";

const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL;
// One handle on every network. The "@teenfreshph" text next to the icons is plain text, not a link.
const SOCIALS = [
  { name: "Facebook", href: "https://www.facebook.com/TeenfreshPH", icon: "FacebookIcon" },
  { name: "X", href: "https://x.com/TeenfreshPH", icon: "XIcon" },
  { name: "Instagram", href: "https://www.instagram.com/teenfreshph", icon: "InstagramIcon" },
  { name: "TikTok", href: "https://www.tiktok.com/@teenfreshph", icon: "TikTokIcon" },
];
const { user, isAdmin, signOut } = useAuth();
const { count } = useCart();
const toast = useToast();
const route = useRoute();
// something is waiting on the shopper (a payment, a receipt): a badge on My orders, and a toast when a new one appears
const userId = computed(() => user.value?.id ?? null);
const { todos, unseen, markAllSeen, markOrderSeen } = useShopperTodos(userId, computed(() => SHOP_ENABLED && Boolean(user.value)), (fresh) => { fresh.forEach((t) => toast(`Order ${t.orderNumber}: ${t.text}`, "info")); playChime("shopper"); });
// opening an order counts as seeing what it needs
const orderId = computed(() => /^\/orders\/([^/]+)/.exec(route.path)?.[1]);
watch([orderId, todos], () => { if (orderId.value && todos.value !== null) markOrderSeen(orderId.value); }, { immediate: true });
let stopUnlock = () => {};
onMounted(() => { stopUnlock = unlockChime() || (() => {}); });   // the browser allows sound after the first click or key press
onBeforeUnmount(() => stopUnlock());
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <SkipLink />
    <header class="sticky top-0 z-30 border-b-2 border-ink bg-brand-cream">
      <nav class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2" aria-label="Main">
        <!-- a plain link: NuxtLink would mark it aria-current on the home page, and .nav-link paints the current page dark -->
        <a href="/" class="nav-link -ml-3" aria-label="Teenfresh Events, home" @click.prevent="navigateTo('/')"><img :src="logo" alt="" width="188" height="40" class="h-10 w-auto"></a>
        <div class="flex flex-wrap items-center gap-1">
          <NuxtLink to="/" exact class="nav-link" title="Events"><IconCalendar /><span class="sr-only">Events</span></NuxtLink>
          <NuxtLink v-if="SHOP_ENABLED" to="/shop" class="nav-link" title="Shop"><IconBag /><span class="sr-only">Shop</span></NuxtLink>
          <NuxtLink v-if="SHOP_ENABLED" to="/cart" class="nav-link" title="Cart"><IconCart /><span class="sr-only">Cart</span><span v-if="count > 0" aria-hidden="true">({{ count }})</span><span v-if="count > 0" class="sr-only">, {{ count }} items</span></NuxtLink>
          <NuxtLink v-if="SHOP_ENABLED && user" to="/my-orders" class="nav-link" title="My orders"><IconPackage /><span class="sr-only">My orders</span></NuxtLink>
          <TodoBell v-if="SHOP_ENABLED && user" :todos="todos" :unseen="unseen" @open="markAllSeen" />
          <NuxtLink v-if="user" to="/my-registrations" class="nav-link" title="My registrations"><IconTicket /><span class="sr-only">My registrations</span></NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin" class="nav-link" title="Admin"><IconDashboard /><span class="sr-only">Admin</span></NuxtLink>
          <button v-if="user" type="button" class="btn-secondary ml-2" title="Sign out" @click="signOut"><IconLogOut /><span class="sr-only">Sign out</span></button>
          <template v-else>
            <NuxtLink to="/login" class="nav-link" title="Sign in"><IconLogIn /><span class="sr-only">Sign in</span></NuxtLink>
            <NuxtLink to="/register" class="btn-primary ml-1" title="Sign up"><IconUserPlus /><span class="sr-only">Sign up</span></NuxtLink>
          </template>
        </div>
      </nav>
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><slot /></main>
    <footer class="border-t-2 border-ink bg-brand-cream py-4">
      <div class="mx-auto flex max-w-6xl flex-wrap px-4 items-center justify-center gap-x-6 gap-y-2 sm:justify-start">
        <nav aria-label="Social media" class="social-row">
          <ul class="social-icons">
            <li v-for="s in SOCIALS" :key="s.name"><a :href="s.href" class="social-link" :aria-label="s.name" :title="s.name" target="_blank" rel="noopener noreferrer"><component :is="s.icon" :size="40" /></a></li>
          </ul>
          <p class="social-handle">@teenfreshph</p>
        </nav>
        <a :href="SUPPORT ? `mailto:${SUPPORT}?subject=Accessibility%20issue` : 'https://x.com/TeenfreshPH'" class="text-sm sm:ml-auto">Report an accessibility issue</a>
      </div>
    </footer>
  </div>
</template>
