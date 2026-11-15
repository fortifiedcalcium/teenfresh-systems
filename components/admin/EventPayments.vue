<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { fetchAll } from "~/lib/api.js";
import { peso } from "~/lib/payment.js";
import { fmtDateTime } from "~/lib/availability.js";
import { exportReport } from "~/lib/excel.js";
import { MEDIA } from "~/lib/breakpoints.js";
import { PAY_TONE as TONE, PAY_LABEL as LABEL, expectedOf } from "~/lib/payments.js";

const toast = useToast();
const { event } = useAdminContext();
const rows = ref(null);
const status = ref("pending");
const q = ref("");
const sel = ref(null);
const split = useMediaQuery(MEDIA.fromTablet);   // 768 and up: list on the left (40%), review on the right (60%)
let channel = null;

async function load() {
  const ev = event.value;
  if (!ev) return;
  const data = await fetchAll(() => supabase.from("payments")
    .select("*, sender_profile:profiles!payments_user_id_fkey(email,full_name), registrations(id,name,x_username,facebook_url,status,ticket_number,kit_name,kit_quantity,total_amount)")
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

const shown = computed(() => (rows.value || []).filter((p) => (!status.value || p.status === status.value)
  && (!q.value || `${p.sender_name} ${p.reference_number} ${(p.registrations || []).map((r) => `${r.name} ${r.x_username}`).join(" ")}`.toLowerCase().includes(q.value.toLowerCase()))));
const counts = computed(() => Object.fromEntries(["pending", "underpaid", "verified", "rejected"].map((s) => [s, (rows.value || []).filter((p) => p.status === s).length])));
const changed = () => { sel.value = null; load(); };
const exportExcel = () => exportReport(toast, `payments-${event.value.ticket_prefix}.xlsx`, ["Sender", "Email", "Amount paid", "Reference", "Status", "Forms", "Submitted"], shown.value.map((p) => [p.sender_name, p.sender_profile?.email, p.amount_paid, p.reference_number, p.status, (p.registrations || []).map((r) => `${r.name} (@${r.x_username})`).join("; "), fmtDateTime(p.created_at)]));
const cols = [
  { key: "sender_name", label: "Sender" },
  { key: "amount_paid", label: "Paid / expected", sortValue: (p) => Number(p.amount_paid) },
  { key: "reference_number", label: "Reference", className: "font-mono" },
  { key: "forms", label: "Forms", sortValue: (p) => (p.registrations || []).length },
  { key: "created_at", label: "Submitted", className: "whitespace-nowrap" },
  { key: "status", label: "Status" },
  { key: "act", label: "", sortable: false },
];
</script>

<template>
  <Empty v-if="!event">Create an event first.</Empty>
  <div v-else class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="flex items-center gap-2 text-2xl"><IconWallet />Payments</h1>
      <TopBarAction :icon="IconDownload" label="Export Excel" short="Export" :disabled="!shown.length" @click="exportExcel" />
    </div>
    <FilterBar :active-count="status !== 'pending' ? 1 : 0">
      <template #search><input v-model="q" class="input w-full md:w-72" placeholder="Search sender, reference, name" aria-label="Search payments"></template>
      <select v-model="status" class="input max-w-[14rem]" aria-label="Payment status">
        <option value="pending">Pending ({{ counts.pending }})</option><option value="underpaid">Underpaid ({{ counts.underpaid }})</option><option value="verified">Verified ({{ counts.verified }})</option><option value="rejected">Rejected ({{ counts.rejected }})</option><option value="">All</option>
      </select>
    </FilterBar>
    <p role="status" class="text-sm font-semibold">{{ rows ? `${shown.length} payment${shown.length === 1 ? "" : "s"} found` : "Loading payments…" }}</p>
    <div :class="split && sel ? 'grid items-start gap-4 md:grid-cols-5' : ''">
      <div class="min-w-0 md:col-span-2">
        <DataTable caption="Payments" :columns="cols" :rows="shown" :loading="rows === null" :cards="split && !!sel" :empty="status === 'pending' ? 'No payments are waiting for review.' : 'No payments match.'" :initial-sort="{ key: 'created_at', dir: 'asc' }">
          <template #cell-sender_name="{ row }">{{ row.sender_name }}<br><span class="text-xs font-normal text-ink-muted">{{ row.sender_profile?.email }}</span></template>
          <template #cell-amount_paid="{ row }"><span :class="Number(row.amount_paid) < expectedOf(row) ? 'font-bold text-danger' : ''">{{ peso(row.amount_paid) }} / {{ peso(expectedOf(row)) }}{{ Number(row.amount_paid) < expectedOf(row) ? " (short)" : "" }}</span></template>
          <template #cell-forms="{ row }"><ul><li v-for="r in row.registrations || []" :key="r.id">{{ r.name }} <span class="text-ink-muted">@{{ r.x_username }}</span></li></ul></template>
          <template #cell-created_at="{ row }">{{ fmtDateTime(row.created_at) }}</template>
          <template #cell-status="{ row }"><Badge :tone="TONE[row.status]">{{ LABEL[row.status] }}</Badge></template>
          <template #cell-act="{ row }"><button type="button" class="btn-primary" @click="sel = row"><IconEye />{{ row.status === "pending" || row.status === "underpaid" ? "Review" : "View" }} <span class="sr-only">payment of {{ row.sender_name }}</span></button></template>
        </DataTable>
      </div>
      <div v-if="sel && split" class="min-w-0 md:sticky md:top-4 md:col-span-3"><PaymentReview :key="sel.id" inline :payment="sel" @close="sel = null" @changed="changed" /></div>
    </div>
    <PaymentReview v-if="sel && !split" :payment="sel" @close="sel = null" @changed="changed" />
  </div>
</template>
