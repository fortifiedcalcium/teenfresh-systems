<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { friendlyError } from "~/lib/api";
import { makeStep3Schema } from "~/lib/validation";
import { zodErrors } from "~/lib/zodErrors";
import { parseAmount, peso, receiptPath, validateReceiptFile } from "~/lib/payment";

// Fix an underpaid or rejected payment: new receipt, reference number and (total) amount.
const props = defineProps({ reg: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["close", "done"]);
const { user } = useAuth();
const toast = useToast();
const pay = props.reg.payments;
const payTotal = props.reg.payTotal || Number(props.reg.events?.registration_fee || 0);   // what the forms on this payment add up to
const underpaid = pay.status === "underpaid";
const paidSoFar = Number(pay.amount_paid || 0);
// Underpaid: only the missing amount is sent now (and added to what was paid before). Rejected: a full payment again.
const missing = underpaid ? Math.max(Number(pay.amount_due ?? payTotal - paidSoFar), 0) : 0;
const minAmount = underpaid ? Math.max(missing, 0.01) : payTotal;
const f = reactive({ reuse_payment_id: "", sender_name: pay.sender_name || "", amount_paid: underpaid ? missing.toFixed(2) : "", reference_number: "", notes: "" });
const file = ref(null);
const fieldErrors = ref<Record<string, string>>({});
const receiptError = ref("");
const serverError = ref("");
const busy = ref(false);
const [focusSignal, bumpFocus] = useErrorFocus();
const errors = computed<Record<string, any>>(() => ({ ...fieldErrors.value, ...(receiptError.value ? { receipt: receiptError.value } : {}) }));
const forms = props.reg.formsOnPayment;

async function submit() {
  fieldErrors.value = zodErrors(makeStep3Schema(minAmount), f);
  receiptError.value = validateReceiptFile(file.value) || "";
  if (Object.keys(fieldErrors.value).length || receiptError.value) { bumpFocus(); return; }
  busy.value = true; serverError.value = "";
  const path = receiptPath(user.value.id, file.value);
  const up = await supabase.storage.from("payment-receipts").upload(path, file.value, { contentType: file.value.type, upsert: false });
  if (up.error) { busy.value = false; serverError.value = "We couldn't upload your receipt. Try again."; return; }
  const { error } = await supabase.rpc("resubmit_payment", { p_payment_id: pay.id, p_sender_name: f.sender_name, p_amount: parseAmount(f.amount_paid), p_reference: f.reference_number, p_receipt_path: path });
  busy.value = false;
  if (error) { serverError.value = friendlyError(error); return; }
  toast("Payment sent for review again.", "success");
  emit("done");
}
</script>

<template>
  <Modal :title="pay.status === 'underpaid' ? 'Send the missing amount' : 'Resubmit your payment'" wide @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent>
      <Alert v-if="pay.status === 'underpaid'" tone="warn">You have paid {{ peso(paidSoFar) }} of {{ peso(payTotal) }}. <strong>Send only the missing {{ peso(missing) }}</strong> by GCash. You do not need to pay the full amount again. {{ pay.review_note }} Then enter the amount you just sent and the reference number of that transfer, and attach its receipt.</Alert>
      <Alert v-else tone="bad">Your payment was not verified. Reason: <strong>{{ pay.review_note }}</strong>. Attach a correct receipt and enter the details of the payment.</Alert>
      <p class="text-sm text-ink-muted">
        <template v-if="underpaid">Send at least {{ peso(missing) }}. It is added to the {{ peso(paidSoFar) }} you already paid, so your total becomes at least {{ peso(paidSoFar + missing) }}.</template>
        <template v-else>The total must be at least {{ peso(payTotal) }}, what the form{{ forms === 1 ? "" : "s" }} on this payment add{{ forms === 1 ? "s" : "" }} up to.</template>
      </p>
      <ErrorSummary :errors="errors" :labels="{ sender_name: 'Name of sender', amount_paid: underpaid ? 'Amount you are sending now' : 'Total amount paid', reference_number: 'Reference number', receipt: 'Payment receipt' }" :focus-signal="focusSignal" :field-ids="{ receipt: 'resub-receipt' }" />
      <Field id="resub-sender" v-slot="a" label="Name of Sender" required :error="errors.sender_name"><input v-bind="a" v-model="f.sender_name" class="input"></Field>
      <Field id="resub-amount" v-slot="a" :label="underpaid ? 'Amount You Are Sending Now' : 'Total Amount Paid'" required :hint="underpaid ? `At least ${peso(missing)}` : undefined" :error="errors.amount_paid"><input v-bind="a" v-model="f.amount_paid" class="input" inputmode="decimal"></Field>
      <Field id="resub-ref" v-slot="a" label="Reference Number (of the new transfer)" required hint="Type it exactly as your banking app shows it" :error="errors.reference_number"><input v-bind="a" v-model="f.reference_number" class="input" autocomplete="off" autocapitalize="none" autocorrect="off" :spellcheck="false" maxlength="80"></Field>
      <FileUpload id="resub-receipt" :model-value="file" :error="receiptError" @update:model-value="(v) => { file = v; receiptError = ''; }" />
      <Alert v-if="serverError" tone="bad">{{ serverError }}</Alert>
      <div class="flex justify-end gap-2"><button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')"><IconClose />Cancel</button><button type="button" class="btn-primary" :disabled="busy" @click="submit"><IconSend />{{ busy ? "Sending…" : "Send for review" }}</button></div>
    </form>
  </Modal>
</template>
