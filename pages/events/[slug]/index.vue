<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient.js";
import { eventStatus } from "~/lib/availability.js";
import { fetchEventImages, imageUrl } from "~/lib/eventImages.js";
import { contactLinkList } from "~/lib/contactLinks.js";
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

async function load() {
  const { data } = await supabase.from("events").select("*").order("event_date");
  const found = findByRef((data || []) as EventRow[], String(route.params.slug));
  event.value = found ?? null;
  if (!found) return;
  if (found.slug && found.slug !== route.params.slug) { await navigateTo(eventPath(found), { replace: true }); return; }   // an old id address moves to the slug
  const [av, imgs, kt] = await Promise.all([
    supabase.from("event_availability").select("registered").eq("event_id", found.id).maybeSingle(),
    fetchEventImages(found.id),
    supabase.from("event_kits").select("*").eq("event_id", found.id).eq("active", true).order("sort_order").order("created_at"),
  ]);
  registered.value = av.data?.registered ?? 0; images.value = imgs as Record<string, ImageRow>; kits.value = (kt.data || []) as KitRow[];
  channel = supabase.channel("event-" + found.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_counts", filter: `event_id=eq.${found.id}` }, (p: { new?: { registered?: number } }) => { registered.value = p.new?.registered ?? 0; })
    .subscribe();
}
onMounted(load);
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
  <div v-else class="mx-auto max-w-3xl space-y-5">
    <nav aria-label="Breadcrumb"><BaseButton to="/" variant="ghost" small><IconArrowLeft />All events</BaseButton></nav>
    <EventHeader :event="event" :st="st!" :kits="kits" as-h1 :required-note="false" />

    <section class="rounded-[1.75rem] bg-white p-5 shadow-[0_6px_20px_color-mix(in_srgb,var(--ink)_12%,transparent)]" aria-labelledby="slots-h">
      <h2 id="slots-h" class="mb-3 text-lg">Slots</h2>
      <AvailabilityBar :registered="Math.min(registered, event.capacity)" :capacity="event.capacity" :label="`Slots taken for ${event.title}`" />
      <p class="mt-2 text-sm font-semibold">{{ st!.key === "closed" ? "Registration is closed" : `${st!.slotsLeft} of ${event.capacity} slots left` }}</p>
      <p v-if="!st!.canRegister" class="mt-1 text-sm text-danger">Registration is unavailable. {{ st!.reason }}</p>
      <div class="mt-4"><BaseButton v-if="st!.canRegister" :to="registerPath(event)" variant="accent" block><IconTicket />Register for this event</BaseButton></div>
    </section>

    <section v-if="images.poster || isAdmin" class="space-y-2" aria-labelledby="poster-h"><h2 id="poster-h" class="text-lg">Event poster</h2><EventImage slot-key="poster" :event="event" :image="images.poster" class="mx-auto max-w-md" @changed="load" /></section>
    <section v-if="images.details_card || event.kit_inclusions?.length || isAdmin" class="space-y-2" aria-labelledby="details-h"><h2 id="details-h" class="text-lg">Event details</h2><EventImage v-if="images.details_card || isAdmin" slot-key="details_card" :event="event" :image="images.details_card" class="mx-auto max-w-md" @changed="load" />
      <div v-if="event.kit_inclusions?.length" class="rounded-2xl bg-brand-ivory p-4 text-sm"><p class="font-semibold">Kit inclusions</p><ul class="mt-1 list-disc pl-5"><li v-for="k in event.kit_inclusions" :key="k">{{ k }}</li></ul></div>
    </section>
    <TermsBox :event="event" default-open />
    <section v-if="links.length" class="rounded-2xl bg-brand-ivory p-4 text-sm" aria-labelledby="contact-h"><h2 id="contact-h" class="text-lg">Questions?</h2><p>Reach us on any of our social media accounts.</p><ContactLinks :links="event.contact_links" /></section>
  </div>
</template>
