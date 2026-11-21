<script setup lang="ts">
import { IconDownload } from "~/lib/icons";
import { supabase } from "~/lib/supabaseClient";
import { fetchAll } from "~/lib/api";
import { peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";
import { exportReport } from "~/lib/excel";
import { MEDIA } from "~/lib/breakpoints";
import { PAY_LABEL as LABEL, activeForms, expectedOf } from "~/lib/payments";

const toast = useToast();
const { events, event } = useAdminContext();
const rows = ref(null);
const status = ref("review");   // review (pending + short) | all | verified
const q = ref("");
const sel = ref(null);
const split = useMediaQuery(MEDIA.fromTablet);   // 768 and up: list on the left (40%), review on the right (60%)
let channel = null;

async function load() {
  const ev = event.value;
  if (!ev) return;
  const data = await fetchAll(() => supabase.from("payments")
    .select("*, sender_profile:profiles!payments_user_id_fkey(email,full_name), registrations(id,name,x_username,facebook_url,status,ticket_number,kit_name,kit_quantity,total_amount,checked_in_at)")
    .eq("event_id", ev.id).order("created_at").order("id"));
  if (event.value?.id !== ev.id) return;
  rows.value = data;
  if (sel.value) sel.value = data.find((p) => p.id === sel.value.id) || null;
}
watch(() => event.value?.id, (id) => {
  rows.value = null;
  if (channel) { supabase.removeChannel(channel); channel = null; }
  if (!id) return;
  load();
  channel = supabase.channel("pay-" + id).on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `event_id=eq.${id}` }, () => load()).subscribe();
}, { immediate: true });
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel); });

const shown = computed(() => (rows.value || []).filter((p) => (status.value === "all" || (status.value === "review" ? (p.status === "pending" || p.status === "underpaid") : p.status === status.value))
  && (!q.value || `${p.sender_name} ${p.reference_number} ${(p.registrations || []).map((r) => `${r.name} ${r.x_username}`).join(" ")}`.toLowerCase().includes(q.value.toLowerCase()))));
const counts = computed(() => Object.fromEntries(["pending", "underpaid", "verified", "rejected"].map((s) => [s, (rows.value || []).filter((p) => p.status === s).length])));
const taken = computed(() => (rows.value || []).filter((p) => p.status !== "rejected").reduce((n, p) => n + activeForms(p).length, 0));
const checkedIn = computed(() => (rows.value || []).reduce((n, p) => n + (p.registrations || []).filter((r) => r.checked_in_at).length, 0));
const shortBy = (p) => Number(p.amount_due) || Math.max(expectedOf(p) - Number(p.amount_paid), 0);
// The list always has one row open beside it on a tablet or laptop, so the review panel is never empty.
watch([shown, split], () => {
  if (!split.value) return;
  if (!shown.value.some((p) => p.id === sel.value?.id)) sel.value = shown.value[0] || null;
}, { immediate: true });
const changed = () => { if (!split.value) sel.value = null; load(); };   // the modal closes after a decision; beside the list the next row opens
const exportExcel = () => exportReport(toast, `payments-${event.value.ticket_prefix}.xlsx`, ["Sender", "Email", "Amount paid", "Reference", "Status", "Forms", "Submitted"], shown.value.map((p) => [p.sender_name, p.sender_profile?.email, p.amount_paid, p.reference_number, p.status, (p.registrations || []).map((r) => `${r.name} (@${r.x_username})`).join("; "), fmtDateTime(p.created_at)]));
const cols = [
  { key: "sender_name", label: "Sender" },
  { key: "amount_paid", label: "Paid / expected", sortValue: (p) => Number(p.amount_paid) },
  { key: "reference_number", label: "Reference", className: "font-mono" },
  { key: "status", label: "Status" },
  { key: "act", label: "", sortable: false },
];
const TABS = [{ key: "review", label: "To review" }, { key: "all", label: "All" }, { key: "verified", label: "Verified" }];
const statusClass = (p) => (p.status === "verified" ? "ok" : p.status === "rejected" ? "bad" : p.status === "underpaid" ? "short" : "review");
const statusText = (p) => (p.status === "pending" ? "To review" : p.status === "underpaid" ? (shortBy(p) > 0 ? `Short ${peso(shortBy(p))}` : "Short") : LABEL[p.status]);

</script>

<template>
  <Empty v-if="!event">Create an event first.</Empty>
  <div v-else class="space-y-5">
    <div class="pay-head">
      <div>
        <h1 class="pay-title">Payments</h1>
        <p class="pay-sub">Check receipts and verify tickets.</p>
      </div>
      <div class="pay-event">
        <TopBarAction :icon="IconDownload" label="Export Excel" short="Export" :disabled="!shown.length" @click="exportExcel" />
        <label for="event-select">Event</label>
        <select id="event-select" class="input" :value="event?.id || ''" :disabled="!events?.length" @change="selectAdminEvent(($event.target as HTMLInputElement).value)">
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
        </select>
      </div>
    </div>

    <ul class="pay-chips" aria-label="Summary">
      <li class="pay-chip pay-chip--slots">{{ taken }} of {{ event.capacity }} slots taken</li>
      <li class="pay-chip pay-chip--wait">{{ counts.pending }} waiting for review</li>
      <li class="pay-chip pay-chip--short">{{ counts.underpaid }} payment{{ counts.underpaid === 1 ? "" : "s" }} short</li>
      <li class="pay-chip pay-chip--in">{{ checkedIn }} checked in</li>
    </ul>

    <div :class="['pay-grid', split && sel ? 'pay-grid--split' : '']">
      <section class="pay-list" aria-label="Payments list">
        <div class="pay-tools">
          <div class="pay-seg" role="group" aria-label="Payment status">
            <button v-for="t in TABS" :key="t.key" type="button" :aria-pressed="status === t.key" @click="status = t.key">{{ t.label }}</button>
          </div>
          <input v-model="q" class="input pay-search" placeholder="Search sender or reference" aria-label="Search payments">
        </div>
        <p role="status" class="sr-only">{{ rows ? `${shown.length} payment${shown.length === 1 ? "" : "s"} found` : "Loading payments…" }}</p>
        <DataTable caption="Payments" :columns="cols" :rows="shown" :loading="rows === null" :row-class="(r) => (r.id === sel?.id ? 'pay-row--sel' : '')" :empty="status === 'review' ? 'No payments are waiting for review.' : 'No payments match.'" :initial-sort="{ key: 'created_at', dir: 'asc' }">
          <template #cell-sender_name="{ row }">{{ row.sender_name }}</template>
          <template #cell-amount_paid="{ row }">{{ peso(row.amount_paid) }} / {{ peso(expectedOf(row)) }}</template>
          <template #cell-status="{ row }"><span :class="['pay-status', `pay-status--${statusClass(row)}`]">{{ statusText(row) }}</span></template>
          <template #cell-act="{ row }">
            <button v-if="row.status === 'pending' || row.status === 'underpaid'" type="button" :class="['pay-btn pay-btn--sm', row.id === sel?.id ? 'pay-btn--accent' : 'pay-btn--ghost']" @click="sel = row">Review <span class="sr-only">payment of {{ row.sender_name }}</span></button>
            <button v-else type="button" class="pay-view" @click="sel = row">View <span class="sr-only">payment of {{ row.sender_name }}</span></button>
          </template>
        </DataTable>
      </section>
      <div v-if="sel && split" class="min-w-0 md:sticky md:top-4"><PaymentReview :key="sel.id" inline :payment="sel" @close="sel = null" @changed="changed" /></div>
    </div>
    <PaymentReview v-if="sel && !split" :payment="sel" @close="sel = null" @changed="changed" />
  </div>
</template>
