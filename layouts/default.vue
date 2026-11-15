<script setup lang="ts">
import logo from "~/assets/logo/teenfresh-logo.png";
import { SHOP_ENABLED } from "~/lib/features";
import { playChime, unlockChime } from "~/lib/chime";

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
const keyboardOpen = useKeyboardOpen();
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
  <div class="no-save flex min-h-screen flex-col">
    <SkipLink />
    <header class="sticky top-0 z-30 px-3 pt-3">
      <nav class="pill-nav" aria-label="Main">
        <!-- a plain link: NuxtLink would mark it aria-current on the home page, and .nav-link paints the current page dark -->
        <a href="/" class="pill-link -ml-1 px-3" aria-label="Teenfresh Events, home" @click.prevent="navigateTo('/')"><img :src="logo" alt="" width="188" height="40" class="h-8 w-auto sm:h-9"></a>
        <!-- desktop: Events, Shop, Cart and one account menu. On a phone these live in the bottom bar. -->
        <div class="hidden items-center gap-1 md:flex">
          <NuxtLink to="/" exact class="pill-link"><IconCalendar />Events</NuxtLink>
          <NuxtLink v-if="SHOP_ENABLED" to="/shop" class="pill-link"><IconBag />Shop</NuxtLink>
          <NuxtLink v-if="SHOP_ENABLED" to="/cart" class="pill-link"><IconCart />Cart<span v-if="count > 0" aria-hidden="true">({{ count }})</span><span v-if="count > 0" class="sr-only">, {{ count }} items</span></NuxtLink>
          <AccountMenu v-if="user" :is-admin="isAdmin" :shop="SHOP_ENABLED" :todos="todos" :unseen="unseen" @open-todos="markAllSeen" @sign-out="signOut" />
          <template v-else>
            <NuxtLink to="/login" class="pill-link"><IconLogIn />Sign in</NuxtLink>
            <BaseButton to="/register" variant="accent" small class="ml-1"><IconUserPlus />Sign up</BaseButton>
          </template>
        </div>
        <!-- phone: signed-out visitors can sign in from the top bar too -->
        <div v-if="!user" class="flex items-center gap-1 md:hidden">
          <NuxtLink to="/login" class="pill-link"><IconLogIn /><span class="sr-only">Sign in</span></NuxtLink>
          <BaseButton to="/register" variant="accent" small><IconUserPlus /><span class="sr-only">Sign up</span></BaseButton>
        </div>
      </nav>
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><slot /></main>
    <!-- phone: the bottom bar -->
    <nav v-show="!keyboardOpen" class="public-bottom-nav md:hidden" aria-label="Main (bottom bar)">
      <ul>
        <li><NuxtLink to="/" exact class="public-nav-item"><IconCalendar /><span class="public-nav-item__label">Events</span></NuxtLink></li>
        <li v-if="SHOP_ENABLED"><NuxtLink to="/shop" class="public-nav-item"><IconBag /><span class="public-nav-item__label">Shop</span></NuxtLink></li>
        <li v-if="SHOP_ENABLED"><NuxtLink to="/cart" class="public-nav-item relative"><IconCart /><span class="public-nav-item__label">Cart</span><span v-if="count > 0" aria-hidden="true" class="notif-badge">{{ count }}</span><span v-if="count > 0" class="sr-only">, {{ count }} items</span></NuxtLink></li>
        <li v-if="user"><AccountMenu above :is-admin="isAdmin" :shop="SHOP_ENABLED" :todos="todos" :unseen="unseen" @open-todos="markAllSeen" @sign-out="signOut" /></li>
        <li v-else><NuxtLink to="/login" class="public-nav-item"><IconLogIn /><span class="public-nav-item__label">Sign in</span></NuxtLink></li>
      </ul>
    </nav>
    <footer class="mt-8 rounded-t-[2rem] bg-brand-cream pb-24 pt-6 md:pb-6">
      <div class="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <nav aria-label="Social media" class="social-row">
          <ul class="social-icons">
            <li v-for="s in SOCIALS" :key="s.name"><a :href="s.href" class="social-link" :aria-label="s.name" :title="s.name" target="_blank" rel="noopener noreferrer"><component :is="s.icon" :size="40" /></a></li>
          </ul>
          <p class="social-handle">@teenfreshph</p>
        </nav>
        <a :href="SUPPORT ? `mailto:${SUPPORT}?subject=Accessibility%20issue` : 'https://x.com/TeenfreshPH'" class="text-sm">Report an accessibility issue</a>
      </div>
    </footer>
  </div>
</template>
