<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { fetchAll } from "~/lib/api.js";
import { fmtDateTime } from "~/lib/availability.js";
import { peso } from "~/lib/payment.js";

const { event } = useAdminContext();
const rows = ref(null);
const recent = ref([]);
const verifiedAmount = ref(0);
let channel = null;

async function load() {
  const ev = event.value;
  if (!ev) return;
  const [all, rec, pays] = await Promise.all([
    fetchAll(() => supabase.from("registrations").select("id,status,created_at,checked_in_at,kit_name,kit_quantity").eq("event_id", ev.id).order("created_at").order("id")),
    supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,checker:profiles!registrations_checked_in_by_fkey(full_name,email)").eq("event_id", ev.id).not("checked_in_at", "is", null).order("checked_in_at", { ascending: false }).limit(8),
    fetchAll(() => supabase.from("payments").select("id,amount_paid").eq("event_id", ev.id).eq("status", "verified").order("id")),
  ]);
  if (event.value?.id !== ev.id) return;
  rows.value = all; recent.value = rec.data || []; verifiedAmount.value = pays.reduce((a, p) => a + Number(p.amount_paid), 0);
}

watch(() => event.value?.id, (id) => {
  rows.value = null;
  if (channel) { supabase.removeChannel(channel); channel = null; }
  if (!id) return;
  load();
  // Realtime: any registration change for this event refreshes the numbers (admins pass RLS)
  channel = supabase.channel("dash-" + id).on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `event_id=eq.${id}` }, () => load()).subscribe();
}, { immediate: true });
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel); });

const m = computed(() => {
  if (!rows.value || !event.value) return null;
  const confirmed = rows.value.filter((r) => r.status === "confirmed");
  const pending = rows.value.filter((r) => r.status === "pending_verification");
  const rejected = rows.value.filter((r) => r.status === "rejected");
  const used = confirmed.length + pending.length;   // pending forms hold a slot too
  // kits to prepare: quantity ordered per kit, split into confirmed and still-pending orders
  const kitMap = new Map();
  [...confirmed.map((r) => [r, "confirmed"]), ...pending.map((r) => [r, "pending"])].forEach(([r, k]) => { if (!r.kit_name) return; const e = kitMap.get(r.kit_name) || { name: r.kit_name, confirmed: 0, pending: 0 }; e[k] += r.kit_quantity || 1; kitMap.set(r.kit_name, e); });
  const checked = confirmed.filter((r) => r.checked_in_at);
  const byDay = new Map();
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); byDay.set(d.toISOString().slice(0, 10), 0); }
  confirmed.forEach((r) => { const k = r.created_at.slice(0, 10); if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1); });
  const byHour = new Map();
  checked.forEach((r) => { const h = new Date(r.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "Asia/Manila" }); byHour.set(h, (byHour.get(h) || 0) + 1); });
  return {
    registered: used, confirmed: confirmed.length, pending: pending.length, rejected: rejected.length, checked: checked.length, remaining: Math.max(event.value.capacity - used, 0),
    kits: [...kitMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    days: [...byDay].map(([k, v]) => ({ label: k.slice(5), value: v })),
    hours: [...byHour].map(([k, v]) => ({ label: k, value: v })),
  };
});
</script>

<template>
  <Empty v-if="!event">Create an event first (Events page).</Empty>
  <Loading v-else-if="!m" label="Loading dashboard…" class="p-12" logo />
  <div v-else class="space-y-6">
    <div><h1 class="flex items-center gap-2 text-2xl"><IconDashboard />Dashboard</h1><p class="text-ink-muted">{{ event.title }}</p></div>
    <section aria-labelledby="stats-h">
      <h2 id="stats-h" class="sr-only">Key numbers</h2>
      <dl class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard :icon="IconUsers" label="Capacity" :value="event.capacity" />
        <StatCard :icon="IconTicket" label="Slots used" :value="m.registered" :sub="`${Math.round((m.registered / event.capacity) * 100)}% full (pending + confirmed)`" />
        <StatCard :icon="IconClock" label="Pending verification" :value="m.pending" :tone="m.pending ? 'text-warning-ink' : 'text-ink'" sub="payments to review" />
        <StatCard :icon="IconCheckCircle" label="Confirmed" :value="m.confirmed" tone="text-success" />
        <StatCard :icon="IconXCircle" label="Rejected" :value="m.rejected" :tone="m.rejected ? 'text-danger' : 'text-ink'" />
        <StatCard :icon="IconWallet" label="Total verified" :value="peso(verifiedAmount)" sub="payments marked verified" />
        <StatCard :icon="IconUserCheck" label="Checked in" :value="m.checked" tone="text-success" />
        <StatCard :icon="IconInbox" label="Slots remaining" :value="m.remaining" :tone="m.remaining === 0 ? 'text-danger' : 'text-ink'" />
      </dl>
    </section>
    <div class="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <section class="card p-4" aria-labelledby="c1"><h2 id="c1" class="mb-3 text-lg">Registrations, last 14 days</h2><BarChart :data="m.days" title="Registrations per day, last 14 days" fill="bg-link" /></section>
      <section class="card p-4" aria-labelledby="c2"><h2 id="c2" class="mb-3 text-lg">Check-ins by hour</h2><BarChart v-if="m.hours.length" :data="m.hours" title="Check-ins per hour" fill="bg-brand-blue" /><p v-else class="py-10 text-center text-ink-muted">No check-ins yet.</p></section>
    </div>
    <section v-if="m.kits.length > 0" class="card p-4" aria-labelledby="kits-h">
      <h2 id="kits-h" class="mb-3 text-lg">Kits ordered</h2>
      <!-- a scrollable region must be keyboard-focusable (axe: scrollable-region-focusable), so tabindex is intentional -->
      <div role="region" aria-label="Kits ordered (scrollable)" tabindex="0" class="relative overflow-x-auto">
        <table class="min-w-full text-sm">
          <caption class="sr-only">Kits ordered, by kit</caption>
          <thead><tr><th scope="col" class="th">Kit</th><th scope="col" class="th">Confirmed</th><th scope="col" class="th">Pending verification</th><th scope="col" class="th">Total</th></tr></thead>
          <tbody class="divide-y divide-brand-sky"><tr v-for="k in m.kits" :key="k.name"><th scope="row" class="td text-left font-semibold">{{ k.name }}</th><td class="td">{{ k.confirmed }}</td><td class="td">{{ k.pending }}</td><td class="td font-bold">{{ k.confirmed + k.pending }}</td></tr></tbody>
        </table>
      </div>
    </section>
    <section class="card p-4" aria-labelledby="rc">
      <h2 id="rc" class="mb-3 flex items-center gap-2 text-lg">Recent check-ins <Badge tone="ok">Live updates</Badge></h2>
      <p v-if="recent.length === 0" class="text-ink-muted">No check-ins yet.</p>
      <ul v-else class="divide-y divide-brand-sky">
        <li v-for="r in recent" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span><strong>{{ r.name }}</strong> <span class="text-ink-muted">@{{ r.x_username }}</span> · <span class="font-mono">{{ r.ticket_number }}</span></span>
          <span class="text-ink-muted">{{ fmtDateTime(r.checked_in_at) }}{{ r.checker ? ` · ${r.checker.full_name || r.checker.email}` : "" }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
