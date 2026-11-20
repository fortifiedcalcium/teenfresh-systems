<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { eventStatus, fmtDate } from "~/lib/availability";
import { imageUrl } from "~/lib/eventImages";
import { SHOP_ENABLED } from "~/lib/features";
import { productImageUrl } from "~/lib/products";
import { peso } from "~/lib/payment";
import { eventPath, productPath } from "~/lib/slug";
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
// An event stays in the upcoming list until it is over (its end time, else its start), even when registration is closed or sold out:
// people still come to see it, and the ticket says "Registration closed". Only events that are over become the quiet list, newest first.
const isOver = (e: EventRow) => new Date(e.ends_at || e.event_date).getTime() <= Date.now();
const moreOpen = computed(() => others.value.filter((e) => !isOver(e)));
const past = computed(() => others.value.filter(isOver).sort((a, b) => b.event_date.localeCompare(a.event_date)));
const headline = computed(() => heroHeadline(home.value, featured.value));
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
      <HomeHero v-if="featured" :event="featured" :registered="counts[featured.id] ?? 0" :banner="banners[featured.id]" :kits="kits[featured.id] || []" :headline="headline" :description="description" :shop="SHOP_ENABLED" />
      <template v-else>
        <div class="space-y-5">
          <h1 id="home-h" class="home-hero__title">{{ headline }}</h1>
          <p class="home-hero__lead max-w-prose text-ink-muted">{{ description }}</p>
        </div>
        <div id="featured-event" class="mx-auto w-full max-w-md lg:ml-auto">
          <Loading v-if="events === null" label="Loading events…" class="p-12" logo />
          <Empty v-else>No events yet. Check back soon!</Empty>
        </div>
      </template>
    </section>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>

    <section v-if="moreOpen.length" id="events" class="scroll-mt-24" aria-labelledby="events-h">
      <h2 id="events-h" class="mb-5 flex items-center gap-2 text-2xl"><IconCalendar />Upcoming events</h2>
      <ul class="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(e, i) in moreOpen" :key="e.id" class="flex"><div class="flex w-full flex-col"><EventCard :event="e" :registered="counts[e.id] ?? 0" :banner-image="banners[e.id]" :kits="kits[e.id] || []" :band="i + 1" /></div></li>
      </ul>
    </section>

    <section aria-labelledby="how-h">
      <h2 id="how-h" class="mb-5 text-2xl">How it works</h2>
      <div class="card-soft grid gap-6 p-6 sm:grid-cols-3 sm:gap-0 sm:divide-x-2 sm:divide-dashed sm:divide-brand-sky sm:p-7">
        <div class="flex gap-4 sm:px-7 sm:first:pl-0 sm:last:pr-0">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-brand-mint font-black">1</span>
          <div><h3 class="text-lg font-black">Fill in the form</h3><p class="mt-1 text-ink-muted">Your details and your kit, in a few short steps.</p></div>
        </div>
        <div class="flex gap-4 sm:px-7 sm:first:pl-0 sm:last:pr-0">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-brand-sky font-black">2</span>
          <div><h3 class="text-lg font-black">Pay by GCash</h3><p class="mt-1 text-ink-muted">Upload your receipt. We check it for you.</p></div>
        </div>
        <div class="flex gap-4 sm:px-7 sm:first:pl-0 sm:last:pr-0">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-brand-cream font-black">3</span>
          <div><h3 class="text-lg font-black">Get your QR ticket</h3><p class="mt-1 text-ink-muted">It arrives by email once your payment is checked.</p></div>
        </div>
      </div>
    </section>

    <section v-if="past.length" :id="moreOpen.length ? undefined : 'events'" class="scroll-mt-24" aria-labelledby="past-h">
      <h2 id="past-h" class="mb-3 text-xl">Past events</h2>
      <ul class="space-y-3">
        <li v-for="(e, i) in past" :key="e.id" class="card-soft flex flex-wrap items-center gap-4 p-3.5">
          <div class="photocard shrink-0" style="width: 4.5rem; padding: 0.3125rem; border-radius: 1rem" :style="{ '--tilt': i % 2 ? '3deg' : '-3deg' }">
            <img v-if="imageUrl(banners[e.id])" :src="imageUrl(banners[e.id])" alt="" class="photocard__img" style="border-radius: 0.6875rem">
            <div v-else class="photocard__img photocard__img--empty" style="font-size: 0.625rem"><span>{{ e.title }}</span></div>
          </div>
          <div class="min-w-0 flex-1"><p class="font-black">{{ e.title }}</p><p class="text-sm text-ink-muted">{{ fmtDate(e.event_date) }}</p><Badge tone="bad" class="mt-1.5">{{ eventStatus(e, counts[e.id] ?? 0).label }}</Badge></div>
          <BaseButton :to="eventPath(e)" variant="ghost" small :aria-label="`View ${e.title}`">View event</BaseButton>
        </li>
      </ul>
    </section>

    <section v-if="SHOP_ENABLED && drop.length" aria-labelledby="drop-h">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="drop-h" class="flex items-center gap-2 text-2xl"><IconBag />Shop</h2>
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
