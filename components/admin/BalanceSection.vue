<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { friendlyError } from "~/lib/api";
import { balanceStage, sendOrderEmail } from "~/lib/orders";
import { parseAmount, peso } from "~/lib/payment";

// Admin: the shopper paid less than they should have. Ask for the remaining amount, then check what they send.
// It appears while an order's items payment (pending) or shipping payment (receipt being checked) is open.
const props = defineProps({ order: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["changed"]);
const toast = useToast();
const stage = computed(() => balanceStage(props.order));                    // "items" | "shipping" | null
const open = computed(() => props.order.balance_status !== "none");
const amount = ref(props.order.balance_due_php ? String(props.order.balance_due_php) : "");
const note = ref(props.order.balance_note || "");
const reason = ref("");
const error = ref("");
const busy = ref(false);
const sending = ref(false);
const expected = computed(() => (stage.value === "items" ? props.order.total_php : props.order.shipping_fee_php));
const what = computed(() => (stage.value === "items" ? "the items" : "the shipping fee"));

async function request(clear = false) {
  error.value = "";
  const value = clear ? 0 : parseAmount(amount.value);
  if (!clear && (Number.isNaN(value) || value <= 0)) { error.value = "Enter the amount the shopper still has to pay, for example 250."; return; }
  if (!clear && value > Number(expected.value)) { error.value = `That is more than ${what.value} cost (${peso(expected.value)}). Enter only what is missing.`; return; }
  busy.value = true;
  const { error: err } = await supabase.rpc("request_balance", { p_order: props.order.id, p_for: stage.value, p_amount: value, p_note: note.value });
  if (err) { busy.value = false; error.value = friendlyError(err); return; }
  sending.value = !clear;
  const mail = clear ? { ok: true } : await sendOrderEmail("order_balance_due", props.order.id);
  sending.value = false;
  busy.value = false;
  toast(clear ? "The request was cancelled" : `Asked the shopper for ${peso(value)}. ${mail.ok ? "They were emailed." : "The email could not be sent: " + mail.error}`, clear || mail.ok ? "success" : "error");
  emit("changed");
}
async function review(approve) {
  error.value = "";
  if (!approve && !reason.value.trim()) { error.value = "Give the shopper a reason, so they know what to fix."; return; }
  busy.value = true;
  const { error: err } = await supabase.rpc("review_balance_payment", { p_order: props.order.id, p_approve: approve, p_note: reason.value });
  busy.value = false;
  if (err) { error.value = friendlyError(err); return; }
  toast(approve ? "The extra payment is confirmed." : "The receipt was sent back to the shopper", "success");
  emit("changed");
}
</script>

<template>
  <section v-if="stage" aria-labelledby="o-balance" class="space-y-2 rounded-lg border border-brand-sky p-3">
    <BusyOverlay :show="sending" label="Sending the email to the shopper…" />
    <h3 id="o-balance" class="flex flex-wrap items-center gap-2 font-black">Underpaid?
      <Badge v-if="order.balance_status === 'awaiting_payment'" tone="warn">Waiting for {{ peso(order.balance_due_php) }}</Badge>
      <Badge v-if="order.balance_status === 'pending_review'" tone="warn">Checking the extra payment</Badge>
    </h3>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>

    <template v-if="order.balance_status !== 'pending_review'">
      <p class="text-ink-muted">{{ open ? "The shopper has been asked to pay the amount below. You can change it or cancel the request." : `If the receipt shows less than ${peso(expected)} for ${what}, ask for the missing amount. The shopper is emailed and pays only that amount.` }}</p>
      <div class="grid gap-3 md:grid-cols-2">
        <Field id="balance_amount" v-slot="a" label="Amount still to pay (PHP)" :hint="`The order asks for ${peso(expected)} for ${what}`"><input v-bind="a" v-model="amount" class="input" inputmode="decimal"></Field>
        <Field id="balance_note" v-slot="a" label="Note for the shopper" hint="Optional, shown on their order"><input v-bind="a" v-model="note" class="input" maxlength="300"></Field>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="request(false)"><IconSend />{{ open ? "Update the amount" : "Ask for the remaining amount" }}</button>
        <button v-if="open" type="button" class="btn-secondary" :disabled="busy" @click="request(true)"><IconClose />Cancel the request</button>
      </div>
    </template>

    <template v-else>
      <p>Expect <strong>{{ peso(order.balance_due_php) }}</strong> · Sender: {{ order.balance_sender_name }} · Reference: <span class="font-mono">{{ order.balance_reference_number }}</span></p>
      <Receipt v-if="order.balance_receipt_path" :path="order.balance_receipt_path" label="Extra payment receipt" />
      <p v-else class="text-ink-muted">No receipt file is stored.</p>
      <Field id="balance_reason" v-slot="a" label="Reason (only needed to send it back)" hint="The shopper sees this and can pay again"><input v-bind="a" v-model="reason" class="input" maxlength="300"></Field>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary" :disabled="busy" @click="review(true)"><IconCheck />Confirm the extra payment</button>
        <button type="button" class="btn-danger" :disabled="busy" @click="review(false)"><IconClose />Send back</button>
      </div>
    </template>
  </section>
</template>
