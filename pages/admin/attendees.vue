<script setup lang="ts">
import { IconDownload } from "~/lib/icons";
import { supabase } from "~/lib/supabaseClient";
import { callFunction, fetchAll, resendMany } from "~/lib/api";
import { exportReport } from "~/lib/excel";
import { normalizeFacebook, normalizePhone, normalizeX, kitLabel, peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";

const EMAIL_BADGE = { sent: "badge-ok", failed: "badge-bad", none: "badge-neutral" };
const STATUS_BADGE = { pending_verification: ["badge-warn", "pending verification"], confirmed: ["badge-ok", "confirmed"], rejected: ["badge-bad", "rejected"], cancelled: ["badge-bad", "cancelled"] };
const PAY_BADGE = { pending: "badge-warn", verified: "badge-ok", underpaid: "badge-warn", rejected: "badge-bad", none: "badge-neutral" };

const { event } = useAdminContext();
const toast = useToast();
const route = useRoute();
const rows = ref(null);
const q = ref("");
const searchEl = ref(null);
// the Search tab in the bottom bar links here with ?focus=search
watch(() => route.query.focus, (f) => { if (f === "search") nextTick(() => searchEl.value?.focus()); }, { immediate: true });
onMounted(() => { if (route.query.focus === "search") searchEl.value?.focus(); });
const fAttend = ref("");
const fEmail = ref("");
const fStatus = ref("");
const fPay = ref("");
const sel = ref(null);
const edit = ref(null);
const confirm = ref(null); // { title, body, label, tone, run }
const busy = ref(false);

async function load() {
  const ev = event.value;
  if (!ev) return;
  try {
    const [regs, emails] = await Promise.all([
      fetchAll(() => supabase.from("registrations").select("*, checker:profiles!registrations_checked_in_by_fkey(full_name,email), payment:payments(status,amount_paid,reference_number,review_note)").eq("event_id", ev.id).order("created_at").order("id")),
      fetchAll(() => supabase.from("registration_email_status").select("registration_id,status,error,sent_at").eq("event_id", ev.id).order("registration_id")),
    ]);
    const em = new Map(emails.map((e) => [e.registration_id, e]));
    rows.value = regs.map((r) => ({ ...r, email_status: em.get(r.id)?.status || "none", email_error: em.get(r.id)?.error, pay_status: r.payment?.status || "none" }));
  } catch { rows.value = []; toast("Could not load attendees", "error"); }
}
watch(() => event.value?.id, () => { rows.value = null; load(); }, { immediate: true });

const shown = computed(() => (rows.value || []).filter((r) => {
  if (fStatus.value && r.status !== fStatus.value) return false;
  if (fPay.value && r.pay_status !== fPay.value) return false;
  if (fAttend.value === "in" && !r.checked_in_at) return false;
  if (fAttend.value === "out" && r.checked_in_at) return false;
  if (fEmail.value && r.email_status !== fEmail.value) return false;
  if (q.value) { const s = `${r.name} ${r.x_username} ${r.email} ${r.ticket_number || ""} ${r.contact_number || ""} ${r.facebook_url || ""}`.toLowerCase(); if (!s.includes(q.value.toLowerCase())) return false; }
  return true;
}));

async function run(fn, okMsg?) {
  busy.value = true;
  try { await fn(); if (okMsg) toast(okMsg, "success"); await load(); } catch (e) { toast(e.message || "Failed", "error"); } finally { busy.value = false; }
}
const resend = (r) => run(async () => { await callFunction("send-confirmation-email", { registration_id: r.id }); }, `Email sent to ${r.email}`);
function resendFailed() {
  const ids = rows.value.filter((r) => r.status === "confirmed" && r.email_status === "failed").map((r) => r.id);
  if (!ids.length) { toast("No failed emails", "info"); return; }
  confirm.value = { title: "Resend failed emails?", body: `Resend ${ids.length} failed confirmation email(s)?`, label: "Resend", tone: "primary", run: () => run(async () => { const { sent, failed } = await resendMany(ids); toast(`${sent} sent, ${failed} still failing`, failed ? "error" : "success"); }) };
}
const mark = (r, present) => run(async () => { const { error } = await supabase.rpc("mark_attendance", { p_registration_id: r.id, p_present: present }); if (error) throw error; sel.value = null; }, present ? "Marked present" : "Attendance cleared");
const setStatus = (r, status) => run(async () => { const { error } = await supabase.from("registrations").update({ status }).eq("id", r.id); if (error) throw error; sel.value = null; }, "Updated");
const restoreStatus = (r) => (r.ticket_number ? "confirmed" : "pending_verification");
const remove = (r) => run(async () => { const { error } = await supabase.from("registrations").delete().eq("id", r.id); if (error) throw error; sel.value = null; }, "Deleted");
function saveEdit() {
  const e = edit.value;
  const x = normalizeX(e.x_username);
  const fb = e.facebook_url ? normalizeFacebook(e.facebook_url) : null;
  const phone = e.contact_number ? normalizePhone(e.contact_number) : null;
  if (e.name.trim().length < 2 || !/^[A-Za-z0-9_]{1,15}$/.test(x) || !/^\S+@\S+\.\S+$/.test(e.email.trim())) { toast("Check the name, X username and email", "error"); return; }
  if ((e.facebook_url && !fb) || (e.contact_number && !phone)) { toast("Check the Facebook link and contact number", "error"); return; }
  // Changing name/email/X username is how a slot is transferred. The database logs who did it (registration_changes).
  run(async () => {
    const { error } = await supabase.from("registrations").update({ name: e.name.trim(), x_username: x, email: e.email.trim().toLowerCase(), facebook_url: fb, contact_number: phone, notes: e.notes?.trim() || null }).eq("id", e.id);
    if (error) throw error; edit.value = null; sel.value = null;
  }, "Saved (change logged)");
}
async function confirmRun() { await confirm.value.run(); confirm.value = null; }

const exportExcel = () => exportReport(toast, `attendees-${event.value.ticket_prefix}.xlsx`,
  ["Ticket", "Name", "X username", "Email", "Facebook", "Contact", "Kit", "Quantity", "Price per kit", "Total", "Notes", "Registered", "Registration status", "Payment status", "Payment reference", "Email status", "Checked in", "Checked in by", "Receipt verified", "Kit claimed"],
  shown.value.map((r) => [r.ticket_number || "", r.name, "@" + r.x_username, r.email, r.facebook_url, r.contact_number, r.kit_name || "", r.kit_name ? r.kit_quantity : "", r.kit_unit_price ?? "", r.total_amount ?? "", r.notes, fmtDateTime(r.created_at), r.status, r.pay_status === "none" ? "" : r.pay_status, r.payment?.reference_number || "", r.email_status, fmtDateTime(r.checked_in_at), r.checker?.full_name || r.checker?.email || "", r.receipt_verified ? "Yes" : "No", r.kit_claimed ? "Yes" : "No"]));

const cols = [
  { key: "name", label: "Name" }, { key: "x_username", label: "X" }, { key: "ticket_number", label: "Ticket", className: "font-mono whitespace-nowrap" },
  { key: "email", label: "Email" }, { key: "facebook_url", label: "Facebook" }, { key: "contact_number", label: "Contact", className: "whitespace-nowrap" },
  { key: "kit_name", label: "Kit", sortValue: (r) => r.kit_name || "" },
  { key: "total_amount", label: "Total", className: "whitespace-nowrap", sortValue: (r) => Number(r.total_amount || 0) },
  { key: "pay_status", label: "Payment" }, { key: "created_at", label: "Registered", className: "whitespace-nowrap" }, { key: "email_status", label: "Email" },
  { key: "attendance", label: "Status", sortValue: (r) => (r.checked_in_at ? 1 : 0) },
  { key: "actions", label: "", sortable: false },
];
const details = computed(() => { const s = sel.value; if (!s) return []; return [["Ticket", s.ticket_number || "Not issued yet"], ["X username", "@" + s.x_username], ["Email", s.email], ["Facebook", s.facebook_url || "—"], ["Contact", s.contact_number || "—"], ["Kit", s.kit_name ? `${kitLabel(s.kit_name, s.kit_quantity)} at ${peso(s.kit_unit_price)}` : "—"], ["Total", Number(s.total_amount) > 0 ? peso(s.total_amount) : "—"], ["Notes", s.notes || "—"],
  ["Registered", fmtDateTime(s.created_at)], ["Status", s.status.replace("_", " ")], ["Payment", s.pay_status === "none" ? "n/a" : `${s.pay_status}${s.payment?.reference_number ? ` (ref ${s.payment.reference_number})` : ""}`],
  ["Checked in", s.checked_in_at ? `${fmtDateTime(s.checked_in_at)}${s.checker ? " by " + (s.checker.full_name || s.checker.email) : ""}` : "No"], ["Receipt verified", s.receipt_verified ? "Yes" : "No"], ["Kit claimed", s.kit_claimed ? "Yes" : "No"], ["Email status", s.email_status + (s.email_error ? ` (${s.email_error})` : "")]]; });
function askRestore() { const s = sel.value; confirm.value = { title: "Restore this slot?", body: `Restore ${s.name}? The slot is taken again (it may fail if the event is full or the X username is in use).`, label: "Restore", tone: "primary", run: () => setStatus(s, restoreStatus(s)) }; }
function askCancel() { const s = sel.value; confirm.value = { title: "Cancel this slot?", body: `Cancel ${s.ticket_number || s.name}? The slot is freed and the ticket stops working.`, label: "Cancel slot", tone: "danger", run: () => setStatus(s, "cancelled") }; }
function askDelete() { const s = sel.value; confirm.value = { title: "Delete this registration?", body: `Permanently delete ${s.name} (${s.ticket_number || "no ticket"})?`, label: "Delete", tone: "danger", run: () => remove(s) }; }
</script>

<template>
  <Empty v-if="!event">Create an event first.</Empty>
  <div v-else class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="flex items-center gap-2 text-2xl"><IconUsers />Attendees</h1>
      <div class="flex flex-wrap gap-2"><button type="button" class="btn-secondary" :disabled="busy || !rows" @click="resendFailed"><IconSend />Resend all failed</button><TopBarAction btn-class="btn-primary" :icon="IconDownload" label="Export Excel" short="Export" :disabled="!shown.length" @click="exportExcel" /></div>
    </div>
    <FilterBar :active-count="[fStatus, fPay, fAttend, fEmail].filter(Boolean).length">
      <template #search><input ref="searchEl" v-model="q" class="input w-full md:w-72" placeholder="Search name, X, email, ticket, contact" aria-label="Search attendees"></template>
      <select v-model="fStatus" class="input max-w-[13rem]" aria-label="Registration status"><option value="">All registrations</option><option value="confirmed">Confirmed</option><option value="pending_verification">Pending verification</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select>
      <select v-model="fPay" class="input max-w-[12rem]" aria-label="Payment status"><option value="">Any payment</option><option value="pending">Payment pending</option><option value="verified">Payment verified</option><option value="underpaid">Underpaid</option><option value="rejected">Payment rejected</option><option value="none">No payment</option></select>
      <select v-model="fAttend" class="input max-w-[11rem]" aria-label="Attendance"><option value="">Any attendance</option><option value="in">Checked in</option><option value="out">Not yet arrived</option></select>
      <select v-model="fEmail" class="input max-w-[11rem]" aria-label="Email status"><option value="">Any email status</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="none">Not sent</option></select>
    </FilterBar>
    <p role="status" class="text-sm font-semibold">{{ rows ? `${shown.length} ${shown.length === 1 ? "attendee" : "attendees"} found` : "Loading attendees…" }}</p>
    <DataTable caption="Attendees" :columns="cols" :rows="shown" :loading="rows === null" empty="No attendees match." :initial-sort="{ key: 'created_at', dir: 'desc' }">
      <template #cell-x_username="{ row }">@{{ row.x_username }}</template>
      <template #cell-ticket_number="{ row }">{{ row.ticket_number || "—" }}</template>
      <template #cell-facebook_url="{ row }"><a v-if="row.facebook_url" :href="row.facebook_url" target="_blank" rel="noopener noreferrer">Profile <span class="sr-only">of {{ row.name }} (opens in a new tab)</span></a><template v-else>—</template></template>
      <template #cell-contact_number="{ row }">{{ row.contact_number || "—" }}</template>
      <template #cell-kit_name="{ row }">{{ row.kit_name ? kitLabel(row.kit_name, row.kit_quantity) : "—" }}</template>
      <template #cell-total_amount="{ row }">{{ Number(row.total_amount) > 0 ? peso(row.total_amount) : "—" }}</template>
      <template #cell-pay_status="{ row }"><span :class="['badge', PAY_BADGE[row.pay_status]]">{{ row.pay_status === "none" ? "n/a" : row.pay_status }}</span></template>
      <template #cell-created_at="{ row }">{{ fmtDateTime(row.created_at) }}</template>
      <template #cell-email_status="{ row }"><span :class="['badge', EMAIL_BADGE[row.email_status]]">{{ row.email_status === "none" ? "not sent" : row.email_status }}</span></template>
      <template #cell-attendance="{ row }">
        <template v-if="row.status === 'confirmed'"><span v-if="row.checked_in_at" class="badge badge-ok">checked in</span><span v-else class="badge badge-neutral">not yet</span></template>
        <span v-else :class="['badge', STATUS_BADGE[row.status][0]]">{{ STATUS_BADGE[row.status][1] }}</span>
      </template>
      <template #cell-actions="{ row }"><button type="button" class="btn-secondary" @click="sel = row"><IconEye />View <span class="sr-only">{{ row.name }}</span></button></template>
    </DataTable>

    <Modal v-if="sel && !edit" :title="sel.name" @close="sel = null">
      <dl class="space-y-1 text-sm">
        <div v-for="[k, v] in details" :key="k" class="flex justify-between gap-4"><dt class="text-ink-muted">{{ k }}</dt><dd class="break-all text-right font-medium">{{ v }}</dd></div>
      </dl>
      <p class="mt-3 text-sm text-ink-muted">Payments are verified on the Payments page.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" :disabled="busy || sel.status !== 'confirmed'" @click="resend(sel)"><IconSend />Resend email</button>
        <button type="button" class="btn-secondary" :disabled="busy || sel.status !== 'confirmed'" @click="mark(sel, !sel.checked_in_at)"><IconUserX v-if="sel.checked_in_at" /><IconUserCheck v-else />{{ sel.checked_in_at ? "Clear attendance" : "Mark present" }}</button>
        <button type="button" class="btn-secondary" @click="edit = { ...sel }"><IconPencil />Edit / transfer</button>
        <button v-if="sel.status === 'cancelled' || sel.status === 'rejected'" type="button" class="btn-secondary" :disabled="busy" @click="askRestore"><IconUndo />Restore slot</button>
        <button v-else type="button" class="btn-secondary" :disabled="busy" @click="askCancel"><IconXCircle />Cancel slot</button>
        <button type="button" class="btn-danger" :disabled="busy" @click="askDelete"><IconTrash />Delete</button>
      </div>
    </Modal>
    <Modal v-if="edit" title="Edit / transfer slot" @close="edit = null">
      <form class="space-y-4" @submit.prevent="saveEdit">
        <p class="alert alert-warn">To transfer a slot, enter the new owner's details. The ticket number stays the same, and the change is logged. Use "Resend email" afterwards to send them the ticket.</p>
        <Field id="e-name" v-slot="a" label="Name"><input v-bind="a" v-model="edit.name" class="input"></Field>
        <Field id="e-x" v-slot="a" label="X username"><input v-bind="a" v-model="edit.x_username" class="input"></Field>
        <Field id="e-mail" v-slot="a" label="Email"><input v-bind="a" v-model="edit.email" type="email" class="input"></Field>
        <Field id="e-fb" v-slot="a" label="Facebook link"><input v-bind="a" v-model="edit.facebook_url" class="input"></Field>
        <Field id="e-tel" v-slot="a" label="Contact number"><input v-bind="a" v-model="edit.contact_number" class="input"></Field>
        <Field id="e-notes" v-slot="a" label="Notes"><textarea v-bind="a" v-model="edit.notes" class="input" rows="2" /></Field>
        <div class="sheet-actions flex justify-end gap-2"><button type="button" class="btn-secondary" @click="edit = null"><IconClose />Cancel</button><button class="btn-primary" :disabled="busy"><IconSave />Save</button></div>
      </form>
    </Modal>
    <ConfirmDialog v-if="confirm" :title="confirm.title" :tone="confirm.tone" :confirm-label="confirm.label" :busy="busy" @cancel="confirm = null" @confirm="confirmRun">{{ confirm.body }}</ConfirmDialog>
  </div>
</template>
