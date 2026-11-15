<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import type { EventRow, ImageRow, KitRow } from "~/types/db";

useSeo({ title: "Upcoming events", description: "Reserve your slot at the next Teenfresh event: cupsleeve events, fan meets and more. Register online and pay by GCash.", path: "/" });

const events = ref<EventRow[] | null>(null);
const counts = ref<Record<string, number>>({});   // event_id -> registered
const banners = ref<Record<string, ImageRow>>({});  // event_id -> banner image row
const kits = ref<Record<string, Pick<KitRow, "unit_price">[]>>({});     // event_id -> its active kits
const error = ref("");
const announce = useAnnounce();
let lastAnnounce = 0;
let alive = true;
let channel: ReturnType<typeof supabase.channel> | null = null;

async function fetchHome() {
  const [ev, av, im, kt] = await Promise.all([
    supabase.from("events").select("*").order("event_date"),
    supabase.from("event_availability").select("event_id,registered"),
    supabase.from("event_images").select("*").eq("slot", "banner"),
    supabase.from("event_kits").select("event_id,unit_price").eq("active", true),
  ]);
  return {
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
  kits.value = d.kits; banners.value = d.banners;
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
onBeforeUnmount(() => { alive = false; if (channel) supabase.removeChannel(channel); });
</script>

<template>
  <div>
    <section class="mb-8 rounded-[2rem] bg-brand-cream p-6 sm:p-8" aria-labelledby="home-h">
      <h1 id="home-h" class="mb-1 flex items-center gap-2 text-3xl sm:text-4xl"><IconCalendar />Upcoming events</h1>
      <p class="max-w-prose text-ink-muted">Pick an event and reserve your slot. Pay by GCash and your ticket arrives by email once the payment is checked.</p>
    </section>
    <Alert v-if="error" tone="bad" class="mb-4">{{ error }}</Alert>
    <Loading v-if="events === null" label="Loading events…" class="p-12" logo />
    <Empty v-else-if="events.length === 0">No events yet. Check back soon!</Empty>
    <ul v-else class="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="(e, i) in events" :key="e.id" class="flex"><div class="flex w-full flex-col"><EventCard :event="e" :registered="counts[e.id] ?? 0" :banner-image="banners[e.id]" :kits="kits[e.id] || []" :band="i" /></div></li>
    </ul>
  </div>
</template>
