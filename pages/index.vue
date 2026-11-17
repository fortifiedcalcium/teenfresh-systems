<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { eventStatus } from "~/lib/availability";
import { SHOP_ENABLED } from "~/lib/features";
import { productImageUrl } from "~/lib/products";
import { peso } from "~/lib/payment";
import { productPath } from "~/lib/slug";
import { badgeFor, cardCategories, priceFor, priceText, stockLabel } from "~/lib/productBadge";
import { preorderNotice } from "~/lib/preorder";
import { groupVariations } from "~/lib/variations";
import { bannerAlt, bannerUrl, heroDescription, heroHeadline, NO_HOME_SETTINGS, pickFeatured } from "~/lib/homeSettings";
import type { HomeSettings } from "~/lib/homeSettings";
import type { EventRow, ImageRow, KitRow } from "~/types/db";
import type { ProductRow, VariationRow } from "~/types/shop";

useSeo({ title: "Upcoming events", description: "Reserve your slot at the next Teenfresh event: cupsleeve events, fan meets and more. Register online and pay by GCash.", path: "/" });

const events = ref<EventRow[] | null>(null);
const counts = ref<Record<string, number>>({});   // event_id -> registered
const banners = ref<Record<string, ImageRow>>({});  // event_id -> banner image row
const kits = ref<Record<string, Pick<KitRow, "unit_price">[]>>({});     // event_id -> its active kits
const drop = ref<ProductRow[]>([]);
const dropVersions = ref<Record<string, VariationRow[]>>({});
const home = ref<HomeSettings>(NO_HOME_SETTINGS);   // the admin-chosen banner picture and featured event
const error = ref("");
const announce = useAnnounce();
let lastAnnounce = 0;
let alive = true;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function fetchHome() {
  const [ev, av, im, kt, pr, vr, hs] = await Promise.all([
    supabase.from("events").select("*").order("event_date"),
    supabase.from("event_availability").select("event_id,registered"),
    supabase.from("event_images").select("*").eq("slot", "banner"),
    supabase.from("event_kits").select("event_id,unit_price").eq("active", true),
    // "Shop the drop": the four newest products
    SHOP_ENABLED ? supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] as ProductRow[] }),
    SHOP_ENABLED ? supabase.from("product_variations").select("*").eq("active", true).order("position") : Promise.resolve({ data: [] as VariationRow[] }),
    supabase.from("home_settings").select("*").maybeSingle(),   // missing before migration 034: then there is no banner and the automatic pick
  ]);
  return {
    home: ((hs.error ? null : hs.data) || NO_HOME_SETTINGS) as HomeSettings,
    drop: (pr.data || []) as ProductRow[],
    dropVersions: groupVariations((vr.data || []) as VariationRow[]) as Record<string, VariationRow[]>,
    ok: !(ev.error || av.error),
    events: (ev.data || []) as EventRow[],
    counts: Object.fromEntries(((av.data || []) as { event_id: string; registered: number }[]).map((r) => [r.event_id, r.registered])) as Record<string, number>,
    banners: Object.fromEntries((im.data || []).map((r: ImageRow) => [r.event_id, r])) as Record<string, ImageRow>,
    kits: (kt.data || []).reduce((m: Record<string, Pick<KitRow, "unit_price">[]>, k: { event_id: string; unit_price: number }) => ({ ...m, [k.event_id]: [...(m[k.event_id] || []), k] }), {}) as Record<string, Pick<KitRow, "unit_price">[]>,
  };
}
// Loaded on the server, so the events are already in the page that search engines and link previews read. If the server could not reach the
// database, the browser asks again once the page is up.
const hydrating = useNuxtApp().isHydrating;
const { data, refresh } = await useAsyncData("home-events", fetchHome);
let retried = false;
watch(data, (d) => {
  if (!d) return;
  kits.value = d.kits; banners.value = d.banners; home.value = d.home; drop.value = d.drop; dropVersions.value = d.dropVersions;
  if (d.ok) { counts.value = d.counts; events.value = d.events; error.value = ""; return; }
  if (import.meta.client && (!hydrating || retried)) { error.value = "We could not load the events. Check your connection and refresh the page."; events.value = []; }
}, { immediate: true });

onMounted(async () => {
  if (hydrating && !data.value?.ok) { retried = true; await refresh(); }
  if (!alive) return;

  // Live availability: event_counts is a public counter table (no attendee data) streamed by Realtime.
  // Screen-reader announcements are throttled to one per 10 s so a busy event does not flood the user.
  channel = supabase.channel("event-counts")
    .on("postgres_changes", { event: "*", schema: "public", table: "event_counts" } as any, (p: { new?: { event_id?: string; registered: number } }) => {
      if (!p.new?.event_id) return;
      counts.value = { ...counts.value, [p.new.event_id]: p.new.registered };
      const e = (events.value || []).find((x) => x.id === p.new?.event_id);
      if (e && Date.now() - lastAnnounce > 10000) {
        lastAnnounce = Date.now();
        announce(`${e.title}: ${Math.max(e.capacity - (p.new?.registered ?? 0), 0)} of ${e.capacity} slots left`);
      }
    })
    .subscribe();
});
// The featured event is the one an admin chose, else the next one people can still register for (or, if none, the first). It is shown in the hero; the others are listed below.
const featured = computed(() => pickFeatured(events.value || [], home.value.featured_event_id, (e) => eventStatus(e, counts.value[e.id] ?? 0).canRegister));
const heroImage = computed(() => bannerUrl(home.value));
const others = computed(() => (events.value || []).filter((e) => e.id !== featured.value?.id));
const headline = computed(() => heroHeadline(home.value, featured.value));
// the last word of the headline is set in the accent colour, as in the design
const headlineStart = computed(() => { const w = headline.value.trim().split(/\s+/); return w.length > 1 ? w.slice(0, -1).join(" ") : headline.value; });
const headlineEnd = computed(() => { const w = headline.value.trim().split(/\s+/); return w.length > 1 ? w[w.length - 1] : ""; });
const description = computed(() => heroDescription(home.value));
const optsOf = (p: ProductRow) => dropVersions.value[p.id] || [];
onBeforeUnmount(() => { alive = false; if (channel) supabase.removeChannel(channel); });
</script>

<template>
  <div class="space-y-12">
    <!-- the hero: the featured event's tagline, two buttons, and the event as a ticket -->
    <section :class="['home-hero', heroImage && 'home-hero--image']" aria-labelledby="home-h">
      <template v-if="heroImage">
        <img :src="heroImage" :alt="bannerAlt(home)" class="home-hero__bg" fetchpriority="high" decoding="async">
        <div class="home-hero__overlay" aria-hidden="true" />
      </template>
      <div class="space-y-5">
        <p class="inline-block rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink shadow-sm">Teenfresh Events</p>
        <h1 id="home-h" class="home-hero__title">{{ headlineStart }}{{ " " }}<span v-if="headlineEnd" class="text-[color:var(--accent-hover)]">{{ headlineEnd }}</span></h1>
        <p class="home-hero__lead max-w-prose text-ink-muted">{{ description }}</p>
        <div class="flex flex-wrap gap-3">
          <BaseButton :to="others.length ? '#events' : '#featured-event'" variant="secondary" class="!border-ink !bg-ink !text-white hover:!bg-ink-muted">See events</BaseButton>
          <BaseButton v-if="SHOP_ENABLED" to="/shop" variant="secondary" class="!border-white !bg-white hover:!bg-brand-sky">Browse shop</BaseButton>
        </div>
      </div>
      <div id="featured-event" class="mx-auto w-full max-w-md lg:ml-auto lg:max-w-none">
        <Loading v-if="events === null" label="Loading events…" class="p-12" logo />
        <EventCard v-else-if="featured" :event="featured" :registered="counts[featured.id] ?? 0" :banner-image="banners[featured.id]" :kits="kits[featured.id] || []" :band="0" priority />
        <Empty v-else>No events yet. Check back soon!</Empty>
      </div>
    </section>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>

    <section v-if="others.length" id="events" :class="['band band--ivory scroll-mt-24 !mt-0 py-8', !(SHOP_ENABLED && drop.length) && '!-mb-6']" aria-labelledby="events-h">
      <div class="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="events-h" class="text-2xl sm:text-3xl">More events</h2>
        <p class="text-sm text-ink-muted">Pick an event and reserve your slot.</p>
      </div>
      <ul class="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(e, i) in others" :key="e.id" class="flex"><div class="flex w-full flex-col"><EventCard :event="e" :registered="counts[e.id] ?? 0" :banner-image="banners[e.id]" :kits="kits[e.id] || []" :band="i + 1" compact /></div></li>
      </ul>
    </section>

    <section v-if="SHOP_ENABLED && drop.length" :class="['band band--sky !-mb-6 !mt-0 py-8']" aria-labelledby="drop-h">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="drop-h" class="text-2xl sm:text-3xl">Shop</h2>
        <BaseButton to="/shop" variant="secondary" small>See more</BaseButton>
      </div>
      <ul class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <li v-for="(p, i) in drop" :key="p.id">
          <ProductCard :title="p.title" :artist="p.artist" :categories="cardCategories(p)" :stock="stockLabel(p, optsOf(p))" :to="productPath(p)" :image="productImageUrl(p)" :image-alt="p.image_alt || ''" :tint="i"
            :price-label="priceText(priceFor(p.price, optsOf(p)), peso)" :discount="p.discount_percent > 0 ? p.discount_percent : undefined"
            :badge="badgeFor(p, optsOf(p))?.label" :badge-tone="badgeFor(p, optsOf(p))?.tone" :notice="preorderNotice(p)" />
        </li>
      </ul>
    </section>
  </div>
</template>
