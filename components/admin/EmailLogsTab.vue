<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { callFunction, fetchAll, resendMany } from "~/lib/api.js";
import { fmtDateTime } from "~/lib/availability.js";

const props = defineProps({ event: { type: Object, required: true } });
const toast = useToast();
const rows = ref(null);
const status = ref("");
const busy = ref(false);

async function load() {
  const { data } = await supabase.from("email_logs").select("id,registration_id,recipient,kind,status,error,sent_at,registrations!left(event_id,ticket_number,name)").order("sent_at", { ascending: false }).limit(500);
  rows.value = (data || []).filter((l) => !l.registrations || l.registrations.event_id === props.event.id);
}
watch(() => props.event.id, () => { rows.value = null; load(); }, { immediate: true });

async function resendFailed() {
  const st = await fetchAll(() => supabase.from("registration_email_status").select("registration_id,status").eq("event_id", props.event.id).order("registration_id"));
  const ids = st.filter((s) => s.status === "failed").map((s) => s.registration_id);
  if (!ids.length) { toast("No failed emails", "info"); return; }
  if (!window.confirm(`Resend ${ids.length} failed email(s)?`)) return;
  busy.value = true;
  try { const { sent, failed } = await resendMany(ids); toast(`${sent} sent, ${failed} still failing`, failed ? "error" : "success"); } catch (e) { toast(e.message, "error"); }
  busy.value = false; load();
}
async function resendOne(id) {
  try { await callFunction("send-confirmation-email", { registration_id: id }); toast("Sent", "success"); } catch (e) { toast(e.message, "error"); }
  load();
}
const shown = computed(() => (rows.value || []).filter((l) => !status.value || l.status === status.value));
const cols = [
  { key: "sent_at", label: "When", className: "whitespace-nowrap" }, { key: "kind", label: "Type" }, { key: "recipient", label: "To" },
  { key: "ticket", label: "Ticket", className: "font-mono", sortValue: (l) => l.registrations?.ticket_number || "" },
  { key: "status", label: "Result" }, { key: "error", label: "Error", className: "max-w-xs break-words text-xs text-danger" },
  { key: "act", label: "", sortable: false },
];
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <select v-model="status" class="input max-w-[10rem]" aria-label="Result filter"><option value="">All results</option><option value="sent">Sent</option><option value="failed">Failed</option></select>
      <button type="button" class="btn-secondary" @click="load"><IconRefresh />Refresh</button>
      <button type="button" class="btn-primary" :disabled="busy" @click="resendFailed"><IconSend />{{ busy ? "Resending…" : "Resend all failed" }}</button>
    </div>
    <DataTable caption="Email logs" :columns="cols" :rows="shown" :loading="rows === null" empty="No emails logged yet." :page-size="30">
      <template #cell-sent_at="{ row }">{{ fmtDateTime(row.sent_at) }}</template>
      <template #cell-ticket="{ row }">{{ row.registrations?.ticket_number || "—" }}</template>
      <template #cell-status="{ row }"><span :class="['badge', row.status === 'sent' ? 'badge-ok' : 'badge-bad']">{{ row.status }}</span></template>
      <template #cell-error="{ row }">{{ row.error || "" }}</template>
      <template #cell-act="{ row }"><button v-if="row.status === 'failed' && row.registration_id && row.kind === 'confirmation'" type="button" class="btn-secondary" @click="resendOne(row.registration_id)"><IconSend />Resend <span class="sr-only">to {{ row.recipient }}</span></button></template>
    </DataTable>
  </div>
</template>
