<script setup>
import { supabase } from "~/lib/supabaseClient.js";

const events = ref(null);
const counts = ref({});   // event_id -> registered
const banners = ref({});  // event_id -> banner image row
const kits = ref({});     // event_id -> its active kits
const error = ref("");
const announce = useAnnounce();
let lastAnnounce = 0;
let alive = true;
let channel = null;

onMounted(async () => {
  const [ev, av, im, kt] = await Promise.all([
    supabase.from("events").select("*").order("event_date"),
    supabase.from("event_availability").select("event_id,registered"),
    supabase.from("event_images").select("*").eq("slot", "banner"),
    supabase.from("event_kits").select("event_id,unit_price").eq("active", true),
  ]);
  if (!alive) return;
  kits.value = (kt.data || []).reduce((m, k) => ({ ...m, [k.event_id]: [...(m[k.event_id] || []), k] }), {});
  banners.value = Object.fromEntries((im.data || []).map((r) => [r.event_id, r]));
  if (ev.error || av.error) { error.value = "We could not load the events. Check your connection and refresh the page."; events.value = []; return; }
  counts.value = Object.fromEntries(av.data.map((r) => [r.event_id, r.registered]));
  events.value = ev.data;

  // Live availability: event_counts is a public counter table (no attendee data) streamed by Realtime.
  // Screen-reader announcements are throttled to one per 10 s so a busy event does not flood the user.
  channel = supabase.channel("event-counts")
    .on("postgres_changes", { event: "*", schema: "public", table: "event_counts" }, (p) => {
      if (!p.new?.event_id) return;
      counts.value = { ...counts.value, [p.new.event_id]: p.new.registered };
      const e = (events.value || []).find((x) => x.id === p.new.event_id);
      if (e && Date.now() - lastAnnounce > 10000) {
        lastAnnounce = Date.now();
        announce(`${e.title}: ${Math.max(e.capacity - p.new.registered, 0)} of ${e.capacity} slots left`);
      }
    })
    .subscribe();
});
onBeforeUnmount(() => { alive = false; if (channel) supabase.removeChannel(channel); });
</script>

<template>
  <div>
    <h1 class="mb-1 flex items-center gap-2 text-3xl"><IconCalendar />Upcoming events</h1>
    <p class="mb-6 text-ink-muted">Pick an event and reserve your slot.</p>
    <Alert v-if="error" tone="bad" class="mb-4">{{ error }}</Alert>
    <Loading v-if="events === null" label="Loading events…" class="p-12" logo />
    <Empty v-else-if="events.length === 0">No events yet. Check back soon!</Empty>
    <ul v-else class="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="e in events" :key="e.id" class="flex"><div class="flex w-full flex-col"><EventCard :event="e" :registered="counts[e.id] ?? 0" :banner-image="banners[e.id]" :kits="kits[e.id] || []" /></div></li>
    </ul>
  </div>
</template>
