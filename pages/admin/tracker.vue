<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { fetchAll } from "~/lib/api.js";
import { exportReport } from "~/lib/excel.js";
import { fmtDateTime } from "~/lib/availability.js";

const RESULT_BADGE = { success: "badge-ok", duplicate: "badge-warn", invalid: "badge-bad" };
const toast = useToast();
const { event } = useAdminContext();
const tab = ref("list");
const rows = ref(null);
const logs = ref(null);
const filter = ref("");
const q = ref("");
let channel = null;

async function load() {
  const ev = event.value;
  if (!ev) return;
  const r = await fetchAll(() => supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,kit_claimed,receipt_verified,checker:profiles!registrations_checked_in_by_fkey(full_name,email)").eq("event_id", ev.id).eq("status", "confirmed").order("created_at").order("id"));
  if (event.value?.id !== ev.id) return;
  rows.value = r;
  const { data } = await supabase.from("attendance_logs").select("id,ticket_number_scanned,result,scanned_at,registrations(name,event_id),scanner:profiles!attendance_logs_scanned_by_fkey(full_name,email)").order("scanned_at", { ascending: false }).limit(300);
  logs.value = data || [];
}
watch(() => event.value?.id, (id) => {
  rows.value = null;
  if (channel) { supabase.removeChannel(channel); channel = null; }
  if (!id) return;
  load();
  channel = supabase.channel("track-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `event_id=eq.${id}` }, () => load())
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, () => load())
    .subscribe();
}, { immediate: true });
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel); });

const counts = computed(() => { const r = rows.value || []; const c = r.filter((x) => x.checked_in_at).length; return { total: r.length, in: c, out: r.length - c }; });
const shown = computed(() => (rows.value || []).filter((r) => (filter.value === "in" ? r.checked_in_at : filter.value === "out" ? !r.checked_in_at : true) && (!q.value || `${r.name} ${r.x_username} ${r.ticket_number}`.toLowerCase().includes(q.value.toLowerCase()))));
const staff = (r) => r.checker?.full_name || r.checker?.email || "";
const shownLogs = computed(() => (logs.value || []).filter((l) => !l.registrations || l.registrations.event_id === event.value?.id));

const exportExcel = () => exportReport(toast, `attendance-${event.value.ticket_prefix}.xlsx`, ["Ticket", "Name", "X username", "Status", "Checked in at", "Checked in by", "Receipt verified", "Kit claimed"],
  shown.value.map((r) => [r.ticket_number, r.name, "@" + r.x_username, r.checked_in_at ? "Checked in" : "Not yet arrived", fmtDateTime(r.checked_in_at), staff(r), r.receipt_verified ? "Yes" : "No", r.kit_claimed ? "Yes" : "No"]));

const cols = [
  { key: "ticket_number", label: "Ticket", className: "font-mono whitespace-nowrap" },
  { key: "name", label: "Name" },
  { key: "x_username", label: "X" },
  { key: "status", label: "Status", sortValue: (r) => (r.checked_in_at ? 1 : 0) },
  { key: "checked_in_at", label: "Time", className: "whitespace-nowrap" },
  { key: "staff", label: "Scanned by", sortValue: staff },
  { key: "receipt_verified", label: "Receipt", sortValue: (r) => +r.receipt_verified },
  { key: "kit_claimed", label: "Kit", sortValue: (r) => +r.kit_claimed },
];
const logCols = [
  { key: "scanned_at", label: "When", className: "whitespace-nowrap" },
  { key: "result", label: "Result" },
  { key: "ticket_number_scanned", label: "Ticket scanned", className: "font-mono" },
  { key: "who", label: "Attendee", sortValue: (l) => l.registrations?.name || "" },
  { key: "scanner", label: "Scanned by", sortValue: (l) => l.scanner?.full_name || l.scanner?.email || "" },
];
const TABS = [["list", "Attendance list", "IconChecklist"], ["log", "Scan audit log", "IconHistory"]];
const FILTERS = [["", "Everyone"], ["in", "Checked in"], ["out", "Not yet arrived"]];
</script>

<template>
  <Empty v-if="!event">Create an event first.</Empty>
  <div v-else class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2"><h1 class="flex items-center gap-2 text-2xl"><IconChecklist />Attendance</h1><span class="badge badge-ok">Live updates</span></div>
      <TopBarAction v-if="tab === 'list'" btn-class="btn-primary" :icon="IconDownload" label="Export Excel" short="Export" :disabled="!shown.length" @click="exportExcel" />
    </div>
    <div class="grid grid-cols-3 gap-2 text-center md:gap-3">
      <div class="card p-3"><p class="text-2xl font-extrabold">{{ counts.total }}</p><p class="text-xs text-ink-muted">Registered</p></div>
      <div class="card p-3"><p class="text-2xl font-extrabold text-success">{{ counts.in }}</p><p class="text-xs text-ink-muted">Checked in</p></div>
      <div class="card p-3"><p class="text-2xl font-extrabold text-warning-ink">{{ counts.out }}</p><p class="text-xs text-ink-muted">Not yet arrived</p></div>
    </div>
    <div class="flex gap-2" role="tablist">
      <button v-for="[k, l, i] in TABS" :key="k" type="button" role="tab" :aria-selected="tab === k" :class="tab === k ? 'btn-primary' : 'btn-secondary'" @click="tab = k"><component :is="i" />{{ l }}</button>
    </div>
    <template v-if="tab === 'list'">
      <div class="flex flex-wrap gap-2">
        <input v-model="q" class="input max-w-xs" placeholder="Search name, X or ticket" aria-label="Search">
        <div role="group" aria-label="Attendance filter" class="flex w-full gap-1 md:hidden">
          <button v-for="[v, l] in FILTERS" :key="v" type="button" :aria-pressed="filter === v" :class="[filter === v ? 'btn-primary' : 'btn-secondary', 'min-w-0 flex-1 px-1 text-xs']" @click="filter = v">{{ l }}</button>
        </div>
        <select v-model="filter" class="input hidden max-w-[12rem] md:block" aria-label="Attendance filter"><option value="">Everyone</option><option value="in">Checked in</option><option value="out">Not yet arrived</option></select>
      </div>
      <DataTable caption="Attendance list" :columns="cols" :rows="shown" :loading="rows === null" empty="No attendees match." :page-size="50" :initial-sort="{ key: 'checked_in_at', dir: 'desc' }">
        <template #cell-x_username="{ row }">@{{ row.x_username }}</template>
        <template #cell-status="{ row }"><span :class="['badge', row.checked_in_at ? 'badge-ok' : 'badge-neutral']">{{ row.checked_in_at ? "Checked in" : "Not yet arrived" }}</span></template>
        <template #cell-checked_in_at="{ row }">{{ fmtDateTime(row.checked_in_at) || "—" }}</template>
        <template #cell-staff="{ row }">{{ staff(row) || "—" }}</template>
        <template #cell-receipt_verified="{ row }">{{ row.receipt_verified ? "✓" : "—" }}</template>
        <template #cell-kit_claimed="{ row }">{{ row.kit_claimed ? "✓" : "—" }}</template>
      </DataTable>
    </template>
    <DataTable v-else caption="Scan audit log" :columns="logCols" :rows="shownLogs" :loading="logs === null" empty="No scans yet." :page-size="50">
      <template #cell-scanned_at="{ row }">{{ fmtDateTime(row.scanned_at) }}</template>
      <template #cell-result="{ row }"><span :class="['badge', RESULT_BADGE[row.result]]">{{ row.result }}</span></template>
      <template #cell-who="{ row }">{{ row.registrations?.name || "—" }}</template>
      <template #cell-scanner="{ row }">{{ row.scanner?.full_name || row.scanner?.email || "—" }}</template>
    </DataTable>
  </div>
</template>
