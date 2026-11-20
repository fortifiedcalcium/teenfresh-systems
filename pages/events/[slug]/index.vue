<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { eventStatus } from "~/lib/availability";
import { fetchEventImages, imageUrl } from "~/lib/eventImages";
import { contactLinkList } from "~/lib/contactLinks";
import { eventPath, findByRef, registerPath } from "~/lib/slug";
import type { EventRow, ImageRow, KitRow } from "~/types/db";

// One event: the facts, the poster, the terms and how many slots are left, with a Register button. Anyone can read it; registering needs an account.
const route = useRoute();
const { isAdmin } = useAuth();
const site = String(useRuntimeConfig().public.siteUrl || "").replace(/\/$/, "");
const event = ref<EventRow | null | undefined>(undefined);   // undefined loading, null not found
const registered = ref(0);
const images = ref<Record<string, ImageRow>>({});
const kits = ref<KitRow[]>([]);
let channel: ReturnType<typeof supabase.channel> | null = null;

async function fetchEvent(slug: string) {
  const { data, error } = await supabase.from("events").select("*").order("event_date");
  if (error) return { ok: false as const };
  const found = findByRef((data || []) as EventRow[], slug) ?? null;
  if (!found) return { ok: true as const, event: null };
  const [av, imgs, kt] = await Promise.all([
    supabase.from("event_availability").select("registered").eq("event_id", found.id).maybeSingle(),
    fetchEventImages(found.id),
    supabase.from("event_kits").select("*").eq("event_id", found.id).eq("active", true).order("sort_order").order("created_at"),
  ]);
  return { ok: true as const, event: found, registered: (av.data?.registered ?? 0) as number, images: imgs as Record<string, ImageRow>, kits: (kt.data || []) as KitRow[] };
}
// Loaded on the server, so the event is already in the page that search engines and link previews read. If the server could not reach the
// database, the browser asks again once the page is up.
const hydrating = useNuxtApp().isHydrating;
const { data, refresh } = await useAsyncData(`event-${route.params.slug}`, () => fetchEvent(String(route.params.slug)));
let retried = false;
function apply(d: typeof data.value) {
  if (!d) return;
  if (!d.ok) { if (import.meta.client && (!hydrating || retried)) event.value = null; return; }
  event.value = d.event;
  if (d.event) { registered.value = d.registered ?? 0; images.value = d.images ?? {}; kits.value = d.kits ?? []; }
}
watch(data, apply, { immediate: true });
// an old id address moves to the slug (a permanent redirect, so search engines follow it)
const e0 = data.value && data.value.ok ? data.value.event : null;
if (e0?.slug && e0.slug !== route.params.slug) await navigateTo(eventPath(e0), { replace: true, redirectCode: 301 });

// an event that does not exist is a real 404 for search engines (the page still shows a friendly message)
if (import.meta.server && data.value?.ok && !data.value.event) setResponseStatus(useRequestEvent()!, 404);

async function load() { retried = true; await refresh(); }
onMounted(async () => {
  if (hydrating && !data.value?.ok) await load();
  const found = event.value;
  if (!found) return;
  channel = supabase.channel("event-" + found.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_counts", filter: `event_id=eq.${found.id}` } as any, (p: { new?: { registered?: number } }) => { registered.value = p.new?.registered ?? 0; })
    .subscribe();
});
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel); });

const st = computed(() => (event.value ? eventStatus(event.value, registered.value) : null));
const poster = computed(() => imageUrl(images.value.poster));
const share = computed(() => poster.value || imageUrl(images.value.banner) || imageUrl(images.value.details_card));
const links = computed(() => contactLinkList(event.value?.contact_links));
const plain = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();

useSeo({
  title: () => event.value?.title ?? "Event",
  description: () => (event.value ? plain(event.value.description) || `${event.value.title}${event.value.venue ? ` at ${event.value.venue}` : ""}. Reserve your slot online.` : undefined),
  image: share, path: () => (event.value ? eventPath(event.value) : route.path),
  jsonLd: () => {
    const e = event.value;
    if (!e) return null;
    const fee = Number(e.registration_fee);
    return {
      "@context": "https://schema.org", "@type": "Event", name: e.title, description: plain(e.description) || undefined,
      startDate: e.event_date, endDate: e.ends_at || undefined, eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: e.venue || "TBA", address: e.venue_address || e.venue || "Philippines" },
      image: share.value ? [share.value] : undefined, organizer: { "@type": "Organization", name: "Teenfresh", url: site },
      offers: { "@type": "Offer", url: `${site}${eventPath(e)}`, priceCurrency: "PHP", price: String(kits.value.length ? Math.min(...kits.value.map((k) => Number(k.unit_price))) : fee), availability: st.value?.canRegister ? "https://schema.org/InStock" : "https://schema.org/SoldOut", validThrough: e.registration_deadline || e.event_date },
    };
  },
});
</script>

<template>
  <Loading v-if="event === undefined" label="Loading event…" class="p-12" logo />
  <div v-else-if="event === null" class="mx-auto max-w-xl space-y-4 text-center">
    <h1 class="text-2xl">Event not found</h1>
    <p class="text-ink-muted">This event may have ended or the address is wrong.</p>
    <BaseButton to="/" variant="secondary"><IconArrowLeft />Back to events</BaseButton>
  </div>
  <div v-else class="mx-auto max-w-5xl space-y-6">
    <nav aria-label="Breadcrumb"><BaseButton to="/" variant="ghost" small><IconArrowLeft />All events</BaseButton></nav>

    <div class="evt-layout">
      <div v-if="images.poster || isAdmin" class="evt-poster-stage">
        <div class="photocard evt-poster" style="--tilt: 2deg">
          <EventImage slot-key="poster" :event="event" :image="images.poster" fill @changed="load" />
        </div>
        <div v-if="st && st.canRegister && st.slotsLeft > 0" class="evt-slots-badge"><strong>{{ st.slotsLeft }}</strong><span>of {{ event.capacity }}<br>slots left</span></div>
      </div>

      <div class="space-y-5">
        <EventHeader :event="event" :st="st!" :kits="kits" as-h1 :required-note="false" :slots-sticker="false" />

        <section class="card-soft p-5">
          <!-- The slot count already shows on the poster badge; this stays just the call to action, so it doesn't repeat. -->
          <p v-if="!st!.canRegister" class="text-sm font-semibold text-danger">{{ st!.reason }}</p>
          <BaseButton v-else :to="registerPath(event)" variant="accent" block><IconTicket />Register for this event</BaseButton>
        </section>
      </div>
    </div>

    <section v-if="images.details_card || event.kit_inclusions?.length || isAdmin" class="space-y-2" aria-labelledby="details-h"><h2 id="details-h" class="text-lg">Event details</h2><EventImage v-if="images.details_card || isAdmin" slot-key="details_card" :event="event" :image="images.details_card" class="w-full" @changed="load" />
      <div v-if="event.kit_inclusions?.length" class="rounded-2xl bg-brand-ivory p-4 text-sm"><p class="font-semibold">Kit inclusions</p><ul class="mt-1 list-disc pl-5"><li v-for="k in event.kit_inclusions" :key="k">{{ k }}</li></ul></div>
    </section>
    <TermsBox :event="event" default-open />
    <section v-if="links.length" class="rounded-2xl bg-brand-ivory p-4 text-sm" aria-labelledby="contact-h"><h2 id="contact-h" class="text-lg">Questions?</h2><p>Reach us on any of our social media accounts.</p><ContactLinks :links="event.contact_links" /></section>
  </div>
</template>
