<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { callFunction, friendlyError, resendMany } from "~/lib/api";
import { kitLabel, peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";
import { PAY_TONE as TONE, PAY_LABEL as LABEL, activeForms, expectedOf } from "~/lib/payments";

const props = defineProps({ payment: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true }, inline: Boolean });
const emit = defineEmits(["close", "changed"]);
const toast = useToast();
const forms = computed(() => activeForms(props.payment));
const expected = computed(() => expectedOf(props.payment));
const paid = computed(() => Number(props.payment.amount_paid));
const short = computed(() => paid.value < expected.value);
const action = ref(null);       // null | verified | underpaid | rejected
const reason = ref("");
const due = ref(short.value ? String(Math.max(expected.value - paid.value, 0).toFixed(2)) : "");
const override = ref(false);
const error = ref("");
const busy = ref(false);
const dupes = ref([]);
const reviewable = computed(() => props.payment.status === "pending" || props.payment.status === "underpaid");

watch(() => props.payment, (p) => {
  supabase.from("payments").select("id,event_id").eq("reference_number", p.reference_number).neq("id", p.id).then(({ data }) => { dupes.value = data || []; });
}, { immediate: true });

async function decide() {
  error.value = "";
  if (action.value === "rejected" && !reason.value.trim()) { error.value = "Give a reason. It is emailed to the person."; return; }
  if (action.value === "underpaid" && !(Number(due.value) > 0)) { error.value = "Enter the remaining amount due."; return; }
  if (action.value === "verified" && short.value && (!override.value || !reason.value.trim())) { error.value = "The amount is below the fee. Tick “Verify anyway” and give a reason to override."; return; }
  busy.value = true;
  const { data, error: err } = await supabase.rpc("review_payment", { p_payment_id: props.payment.id, p_decision: action.value, p_reason: reason.value.trim() || null, p_override: override.value, p_amount_due: action.value === "underpaid" ? Number(due.value) : null });
  if (err) { busy.value = false; error.value = friendlyError(err); return; }
  // The decision is saved. Now the email(s); a failure here does not undo the decision (see Email logs to resend).
  let sent = 0, failed = 0;
  try {
    if (action.value === "verified") ({ sent, failed } = await resendMany(data.registration_ids));
    else { const r = await callFunction("send-payment-email", { kind: action.value === "underpaid" ? "payment_underpaid" : "payment_rejected", payment_id: props.payment.id }); r.results.forEach((x) => (x.status === "sent" ? sent++ : failed++)); }
  } catch { failed = Math.max(forms.value.length, 1); }
  busy.value = false;
  toast(failed ? `Saved. ${failed} email(s) did not send: use Resend.` : `Payment ${LABEL[action.value].toLowerCase()}. ${sent} email(s) sent.`, failed ? "error" : "success");
  emit("changed");
}
async function resendNotice() {
  busy.value = true;
  try {
    if (props.payment.status === "verified") await resendMany(forms.value.map((f) => f.id));
    else await callFunction("send-payment-email", { kind: props.payment.status === "underpaid" ? "payment_underpaid" : "payment_rejected", payment_id: props.payment.id });
    toast("Email sent", "success");
  } catch (e) { toast(e.message, "error"); }
  busy.value = false;
}
const cancelAction = () => { action.value = null; error.value = ""; };
const p = computed(() => props.payment);
const confirmTitle = computed(() => (action.value === "verified" ? "Verify this payment?" : action.value === "underpaid" ? "Mark this payment as underpaid?" : "Reject this payment?"));
const confirmLabel = computed(() => (action.value === "verified" ? "Verify and send tickets" : action.value === "underpaid" ? "Mark underpaid and email" : "Reject and email"));
const reasonLabel = computed(() => (action.value === "rejected" ? "Reason (emailed to the person)" : action.value === "underpaid" ? "Note to the person (optional)" : "Reason for the override"));
const details = computed(() => [
  ["Sender", p.value.sender_name], ["Submitted by", p.value.sender_profile ? `${p.value.sender_profile.full_name || ""} ${p.value.sender_profile.email}` : "—"],
  ["Amount paid", peso(paid.value)], ...(p.value.amount_history?.length ? [["Earlier totals", p.value.amount_history.map((a) => peso(a)).join(", ") + " (each resubmission adds to the total)"]] : []),
  [`Expected (${forms.value.length} form${forms.value.length === 1 ? "" : "s"})`, peso(expected.value)],
]);
const moreDetails = computed(() => [["Submitted", fmtDateTime(p.value.created_at)], ...(p.value.amount_due ? [["Amount due", peso(p.value.amount_due)]] : []), ...(p.value.review_note ? [["Note", p.value.review_note]] : []), ...(p.value.resubmission_count ? [["Resubmitted", `${p.value.resubmission_count} time(s)`]] : [])]);
</script>

<template>
  <ReviewShell :inline="inline" :title="`Payment of ${peso(paid)} from ${payment.sender_name}`" @close="emit('close')">
    <div :class="['grid gap-5', inline ? '' : 'lg:grid-cols-2']">
      <section aria-labelledby="rcpt-h" class="space-y-3">
        <h3 id="rcpt-h" class="text-lg">Receipt</h3>
        <PaymentReceipt v-if="payment.receipt_path" :path="payment.receipt_path" :label="`GCash receipt, reference ${payment.reference_number}`" />
        <Alert v-else tone="warn">The receipt file was deleted{{ payment.receipt_deleted_at ? ` on ${fmtDateTime(payment.receipt_deleted_at)}` : "" }}.</Alert>
        <details v-if="payment.receipt_history?.length > 0"><summary class="min-h-target cursor-pointer py-2 font-semibold">Earlier receipts ({{ payment.receipt_history.length }})</summary><div class="space-y-4"><PaymentReceipt v-for="(path, i) in payment.receipt_history" :key="path" :path="path" :label="`Earlier receipt ${Number(i) + 1}, reference ${payment.reference_history?.[i] || 'unknown'}`" /></div></details>
      </section>

      <section aria-labelledby="det-h" class="space-y-3">
        <h3 id="det-h" class="text-lg">Details</h3>
        <dl class="space-y-1 text-sm">
          <div class="flex flex-wrap justify-between gap-2"><dt class="font-semibold">Status</dt><dd class="text-right"><Badge :tone="TONE[payment.status]">{{ LABEL[payment.status] }}</Badge></dd></div>
          <div v-for="[k, v] in details" :key="k" class="flex flex-wrap justify-between gap-2"><dt class="font-semibold">{{ k }}</dt><dd class="text-right">{{ v }}</dd></div>
          <div class="flex flex-wrap justify-between gap-2"><dt class="font-semibold">Reference</dt><dd class="text-right"><span class="font-mono">{{ payment.reference_number }}</span></dd></div>
          <div v-for="[k, v] in moreDetails" :key="k" class="flex flex-wrap justify-between gap-2"><dt class="font-semibold">{{ k }}</dt><dd class="text-right">{{ v }}</dd></div>
        </dl>
        <div><p class="font-semibold">Linked forms</p>
          <ul class="mt-1 space-y-1 text-sm"><li v-for="r in payment.registrations || []" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 rounded border border-brand-sky p-2"><span>{{ r.name }} <span class="text-ink-muted">@{{ r.x_username }}</span><span v-if="r.kit_name" class="block text-ink-muted">{{ kitLabel(r.kit_name, r.kit_quantity) }} = {{ peso(r.total_amount) }}</span><template v-if="r.facebook_url"> · <a :href="r.facebook_url" target="_blank" rel="noopener noreferrer">Facebook <span class="sr-only">of {{ r.name }} (opens in a new tab)</span></a></template></span><span class="flex gap-2"><Badge :tone="r.status === 'confirmed' ? 'ok' : r.status === 'pending_verification' ? 'warn' : 'bad'">{{ r.status.replace("_", " ") }}</Badge><span v-if="r.ticket_number" class="font-mono">{{ r.ticket_number }}</span></span></li></ul>
        </div>
        <Alert v-if="short && reviewable" tone="warn">The amount paid ({{ peso(paid) }}) is lower than expected ({{ peso(expected) }}). Convenience or transaction fees are not covered by the kit price.</Alert>
        <Alert v-if="paid > expected && expected > 0" tone="info">The amount is higher than expected ({{ peso(expected) }}). It may cover more forms the person has not submitted yet.</Alert>
        <Alert v-if="dupes.length > 0" tone="bad">This reference number also appears on {{ dupes.length }} other payment(s). Check that the receipt is not reused.</Alert>
      </section>
    </div>

    <div v-if="reviewable && !action" class="sheet-actions mt-5 flex flex-wrap gap-2">
      <button type="button" class="btn-primary" @click="action = 'verified'"><IconCheckCircle />Verify payment</button>
      <button type="button" class="btn-secondary" @click="action = 'underpaid'"><IconAlert />Mark underpaid</button>
      <button type="button" class="btn-danger" @click="action = 'rejected'"><IconXCircle />Reject payment</button>
    </div>
    <div v-if="!reviewable" class="mt-5 border-t border-brand-sky pt-4"><button type="button" class="btn-secondary" :disabled="busy" @click="resendNotice"><IconSend />Resend the email for this decision</button></div>

    <ConfirmDialog v-if="action" :title="confirmTitle" :tone="action === 'rejected' ? 'danger' : 'primary'" :confirm-label="confirmLabel" :busy="busy" @cancel="cancelAction" @confirm="decide">
      <div class="space-y-3">
        <p v-if="action === 'verified'">{{ forms.length }} form(s) will be confirmed, get ticket numbers and receive the confirmation email.</p>
        <template v-if="action === 'underpaid'"><p>The forms stay pending and keep their slots. The person is emailed the amount due and can resubmit.</p><Field id="due" v-slot="a" label="Amount still due (PHP)" required><input v-bind="a" v-model="due" class="input" inputmode="decimal"></Field></template>
        <p v-if="action === 'rejected'">The forms are rejected and their slots are released. The person is emailed the reason and can resubmit.</p>
        <label v-if="action === 'verified' && short" class="flex items-start gap-3"><input v-model="override" type="checkbox" class="check"><span class="py-1">Verify anyway: the amount paid is below {{ peso(expected) }}</span></label>
        <Field v-if="action !== 'verified' || (short && override)" id="reason" v-slot="a" :label="reasonLabel" :required="action === 'rejected' || action === 'verified'"><textarea v-bind="a" v-model="reason" class="input" rows="3" /></Field>
        <Alert v-if="error" tone="bad">{{ error }}</Alert>
      </div>
    </ConfirmDialog>
  </ReviewShell>
</template>
