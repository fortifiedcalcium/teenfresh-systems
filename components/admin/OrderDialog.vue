<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { MAX_TRACKING, OTHER_COURIER, SHIPPING, STATUS, courierValue, isFullyPaid, paymentReferences, sendOrderEmail, splitCourier } from "~/lib/orders.js";
import { peso, parseAmount } from "~/lib/payment.js";
import { friendlyError } from "~/lib/api.js";
import { fmtDateTime } from "~/lib/availability.js";

const MAIL_LABEL = { order_received: "Order received (old, no longer sent)", order_paid: "Payment confirmed", order_balance_due: "Payment short: remaining amount", order_shipping_due: "Shipping fee to pay", order_shipped: "Shipped", order_cancelled: "Cancelled" };
const props = defineProps({ order: { type: Object, required: true } });
const emit = defineEmits(["close", "changed"]);
const toast = useToast();
const items = ref([]);
const note = ref(props.order.admin_note || "");
const busy = ref(false);
const mails = ref([]);
const fee = ref(props.order.shipping_fee_php == null ? "" : String(props.order.shipping_fee_php));
const reason = ref("");
const feeError = ref("");
const sending = ref(false);          // an email is on its way: show the loading screen
onMounted(() => {
  supabase.from("order_emails").select("*").eq("order_id", props.order.id).order("sent_at", { ascending: false }).then(({ data }) => { mails.value = data || []; });
  supabase.from("order_items").select("*").eq("order_id", props.order.id).order("title").then(({ data }) => { items.value = data || []; });
});
const couriers = useCouriers();
const courierChoice = ref("");
const courierOther = ref("");
// start from the courier already used, else what the shopper asked for, once the list has loaded
watch([couriers, () => props.order.courier, () => props.order.preferred_courier], () => { if (!couriers.value) return; const s = splitCourier(props.order.courier || props.order.preferred_courier, couriers.value); courierChoice.value = s.choice; courierOther.value = s.other; }, { immediate: true });
const tracking = ref(props.order.tracking_number || "");
const shipError = ref("");

/** The courier and tracking number to save, or null (and a message on screen) when they are not valid. */
function shipment() {
  shipError.value = "";
  const c = courierValue(courierChoice.value, courierOther.value);
  if (c.error) { shipError.value = c.error; return null; }
  const t = tracking.value.trim();
  if (t.length > MAX_TRACKING) { shipError.value = `The tracking number can be ${MAX_TRACKING} characters at most.`; return null; }
  return { courier: c.value, tracking_number: t || null };
}
async function saveShipment() {
  const ship = shipment();
  if (!ship) return;
  busy.value = true;
  const { error } = await supabase.from("orders").update({ ...ship, updated_at: new Date().toISOString() }).eq("id", props.order.id);
  busy.value = false;
  if (error) { toast(error.message, "error"); return; }
  toast("Courier and tracking number saved", "success");
  emit("changed");
}
/** Once everything is paid the receipts are not needed: delete the files and keep only the reference numbers. Returns false if it could not. */
async function purgeReceipts() {
  const o = props.order;
  const paths = [o.receipt_path, o.shipping_receipt_path, o.balance_receipt_path].filter(Boolean);
  if (!paths.length) return true;
  const { error } = await supabase.storage.from("payment-receipts").remove(paths);
  if (error) return false;
  const { error: e2 } = await supabase.from("orders").update({ receipt_path: null, shipping_receipt_path: null, balance_receipt_path: null }).eq("id", o.id);
  return !e2;
}
const warnPurge = (ok) => { if (!ok) toast("The receipt files could not be deleted. Open the order again and press Delete receipt files.", "error"); };
async function deleteLeftover() {
  busy.value = true;
  const ok = await purgeReceipts();
  busy.value = false;
  if (!ok) { toast("The receipt files could not be deleted. Try again.", "error"); return; }
  toast("Receipt files deleted. Only the reference numbers are kept.", "success");
  emit("changed");
}
async function setStatus(status) {
  const o = props.order;
  const ship = status === "shipped" ? shipment() : {};
  if (!ship) return;
  busy.value = true;
  const { error } = await supabase.from("orders").update({ status, ...ship, admin_note: note.value.trim() || null, updated_at: new Date().toISOString() }).eq("id", o.id);
  busy.value = false;
  if (error) { toast(error.message, "error"); return; }
  if (status === "paid" && isFullyPaid({ ...o, status })) warnPurge(await purgeReceipts());      // nothing left to pay (free shipping, or an older order)
  sending.value = true;
  const mail = await sendOrderEmail(`order_${status}`, o.id);
  sending.value = false;
  toast(`Order ${o.order_number}: ${status === "paid" && !isFullyPaid({ ...o, status }) ? "payment confirmed, the shipping fee is next" : STATUS[status].label}. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}`, mail.ok ? "success" : "error");
  emit("changed");
}
async function sendFee() {
  const o = props.order;
  feeError.value = "";
  const amount = parseAmount(fee.value);
  if (Number.isNaN(amount) || amount > 100000) { feeError.value = "Enter the shipping fee in pesos, for example 150 (0 for free shipping)."; return; }
  busy.value = true;
  const { error } = await supabase.rpc("set_order_shipping", { p_order: o.id, p_fee: amount });
  if (error) { busy.value = false; toast(friendlyError(error), "error"); return; }
  if (amount === 0 && o.status === "paid") warnPurge(await purgeReceipts());                  // free shipping: everything is paid now
  sending.value = amount > 0;
  const mail = amount > 0 ? await sendOrderEmail("order_shipping_due", o.id) : { ok: true };
  sending.value = false;
  busy.value = false;
  toast(amount > 0 ? `Shipping fee ${peso(amount)} set. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}` : "Free shipping set for this order", mail.ok ? "success" : "error");
  emit("changed");
}
async function reviewShipping(approve) {
  const o = props.order;
  feeError.value = "";
  if (!approve && !reason.value.trim()) { feeError.value = "Give the shopper a reason, so they know what to fix."; return; }
  busy.value = true;
  const { error } = await supabase.rpc("review_shipping_payment", { p_order: o.id, p_approve: approve, p_note: reason.value });
  busy.value = false;
  if (error) { toast(friendlyError(error), "error"); return; }
  if (approve && o.status === "paid") warnPurge(await purgeReceipts());                       // the shipping fee is paid too: everything is paid
  toast(approve ? "Shipping payment confirmed. You can mark the order as shipped." : "The shipping receipt was sent back to the shopper", "success");
  emit("changed");
}
const shipOk = computed(() => props.order.shipping_status === "paid" || props.order.shipping_status === undefined);
const fullyPaid = computed(() => isFullyPaid(props.order));
const leftoverReceipts = computed(() => Boolean(props.order.receipt_path || props.order.shipping_receipt_path || props.order.balance_receipt_path));
const balanceOpen = computed(() => Boolean(props.order.balance_status) && props.order.balance_status !== "none");
const NEXT = { pending: [["paid", "Mark as paid", "IconCheck"], ["cancelled", "Cancel order", "IconClose"]], paid: [["shipped", "Mark as shipped", "IconPackage"], ["cancelled", "Cancel order", "IconClose"]], shipped: [], cancelled: [] };
const next = computed(() => NEXT[props.order.status] || []);
const close = () => { if (!sending.value) emit("close"); };
</script>

<template>
  <Modal :title="`Order ${order.order_number}`" wide @close="close">
    <BusyOverlay :show="sending" label="Sending the email to the shopper…" />
    <div class="space-y-4 text-sm">
      <div class="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="o-ship"><h3 id="o-ship" class="font-black">Deliver to</h3><p>{{ order.name }}<br>{{ order.address }}<br>{{ order.city }} {{ order.postal_code }}<br>{{ order.phone }}<br>{{ order.email }}</p><p v-if="order.notes" class="mt-1"><span class="font-semibold">Buyer's note:</span> {{ order.notes }}</p><p class="mt-1"><span class="font-semibold">Preferred courier:</span> <template v-if="order.preferred_courier">{{ order.preferred_courier }}</template><span v-else class="text-ink-muted">not chosen yet</span></p></section>
        <section aria-labelledby="o-pay"><h3 id="o-pay" class="font-black">Payment to check</h3><p>Expect <strong>{{ peso(order.total_php) }}</strong> ({{ peso(order.subtotal_php) }} items{{ Number(order.shipping_php) > 0 ? ` plus ${peso(order.shipping_php)} shipping` : "" }})<br>Sender: {{ order.sender_name }}<br>Reference: <span class="font-mono">{{ order.reference_number }}</span></p></section>
      </div>
      <ul class="divide-y divide-brand-sky rounded-lg border border-brand-sky px-3">
        <li v-for="i in items" :key="i.id" class="flex justify-between gap-3 py-2"><span class="break-words">{{ i.artist }}: <strong>{{ i.title }}</strong><template v-if="i.variation_name"> · {{ i.variation_name }}</template></span><span class="tabular-nums">{{ peso(i.unit_price_php) }} × {{ i.quantity }}</span></li>
      </ul>
      <div v-if="fullyPaid" class="space-y-2 rounded-lg bg-brand-ivory p-3">
        <p>Everything is paid, so the receipts are no longer kept. Only the reference numbers are stored:</p>
        <ul class="space-y-0.5">
          <li v-for="(r, i) in paymentReferences(order)" :key="`${r.label}-${i}`"><span class="font-semibold">{{ r.label }}:</span> <span class="font-mono">{{ r.reference }}</span></li>
        </ul>
        <div v-if="leftoverReceipts" class="flex flex-wrap items-center gap-2"><p class="text-ink-muted">Receipt files from before are still in storage, but they are not shown.</p><button type="button" class="btn-secondary" :disabled="busy" @click="deleteLeftover"><IconTrash />Delete receipt files</button></div>
      </div>
      <Receipt v-else-if="order.receipt_path" :path="order.receipt_path" />
      <p v-else class="text-ink-muted">No receipt file is stored for this order.</p>
      <BalanceSection :key="`${order.balance_status}-${order.balance_due_php}`" :order="order" @changed="emit('changed')" />
      <CourierEditor v-if="(order.status === 'pending' || order.status === 'paid') && order.shipping_status && order.shipping_status !== 'paid'" :key="order.preferred_courier || 'none'" :order="order" @saved="emit('changed')" />
      <section v-if="order.status === 'paid' && order.shipping_status" aria-labelledby="o-shipfee" class="space-y-2 rounded-lg border border-brand-sky p-3">
        <h3 id="o-shipfee" class="flex flex-wrap items-center gap-2 font-black">Shipping fee <Badge :tone="SHIPPING[order.shipping_status].tone">{{ SHIPPING[order.shipping_status].label }}</Badge></h3>
        <Alert v-if="feeError" tone="bad">{{ feeError }}</Alert>
        <template v-if="order.shipping_status === 'none' || order.shipping_status === 'awaiting_payment'">
          <p class="text-ink-muted">{{ order.shipping_status === "none" ? "Set what this shopper pays for shipping. They are emailed and can then pay it from their order page." : "The shopper has not paid yet. You can still change the fee." }}</p>
          <InputWithAction id="ship_fee" v-model="fee" label="Shipping fee (PHP)" hint="0 = free shipping" input-class="input w-40" inputmode="decimal">
            <template #action><button type="button" class="btn-primary" :disabled="busy" @click="sendFee"><IconSend />{{ order.shipping_status === "none" ? "Send shipping fee" : "Update fee" }}</button></template>
          </InputWithAction>
        </template>
        <template v-if="order.shipping_status === 'pending_review'">
          <p>Expect <strong>{{ peso(order.shipping_fee_php) }}</strong> · Sender: {{ order.shipping_sender_name }} · Reference: <span class="font-mono">{{ order.shipping_reference_number }}</span></p>
          <Receipt v-if="order.shipping_receipt_path" :path="order.shipping_receipt_path" label="Shipping payment receipt" />
          <p v-else class="text-ink-muted">No receipt file is stored.</p>
          <Field id="ship_reason" v-slot="a" label="Reason (only needed to send it back)" hint="The shopper sees this and can pay again"><input v-bind="a" v-model="reason" class="input" maxlength="300"></Field>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-primary" :disabled="busy || balanceOpen" @click="reviewShipping(true)"><IconCheck />Confirm shipping payment</button>
            <button type="button" class="btn-danger" :disabled="busy" @click="reviewShipping(false)"><IconClose />Send back</button>
          </div>
        </template>
        <p v-if="order.shipping_status === 'paid' && order.shipping_fee_php != null">{{ Number(order.shipping_fee_php) > 0 ? `${peso(order.shipping_fee_php)} received.` : "Free shipping." }} You can mark the order as shipped.</p>
        <p v-if="order.shipping_status !== 'paid' && order.shipping_status !== undefined" class="text-ink-muted">You can mark the order as shipped after the shipping fee is paid.</p>
      </section>
      <section v-if="order.status === 'shipped' || (order.status === 'paid' && shipOk)" aria-labelledby="o-courier" class="space-y-2 rounded-lg border border-brand-sky p-3">
        <h3 id="o-courier" class="font-black">Courier and tracking number</h3>
        <p class="text-ink-muted">{{ order.status === "paid" ? "Fill these in, then press Mark as shipped. The shopper sees them on their order page and in the shipped email." : "The shopper sees these on their order page. You can correct them here." }}</p>
        <Alert v-if="shipError" tone="bad">{{ shipError }}</Alert>
        <div class="grid gap-3 md:grid-cols-2">
          <Field id="courier" v-slot="a" label="Courier" :required="order.status === 'paid'">
            <select v-bind="a" v-model="courierChoice" class="input">
              <option value="">Choose a courier…</option>
              <option v-for="c in couriers || []" :key="c" :value="c">{{ c }}</option>
              <option :value="OTHER_COURIER">{{ OTHER_COURIER }}…</option>
            </select>
          </Field>
          <Field v-if="courierChoice === OTHER_COURIER" id="courier_other" v-slot="a" label="Courier name" required><input v-bind="a" v-model="courierOther" class="input" maxlength="60"></Field>
          <Field id="tracking_number" v-slot="a" label="Tracking number" hint="Leave empty if the courier gives none"><input v-bind="a" v-model="tracking" class="input" :maxlength="MAX_TRACKING" autocomplete="off"></Field>
        </div>
        <div v-if="order.status === 'shipped'"><button type="button" class="btn-secondary" :disabled="busy" @click="saveShipment"><IconSave />Save courier and tracking</button></div>
      </section>
      <section v-if="mails.length > 0" aria-labelledby="o-mail"><h3 id="o-mail" class="font-black">Emails to the shopper</h3>
        <ul class="mt-1 space-y-1"><li v-for="m in mails" :key="m.id" class="flex flex-wrap items-center gap-2"><Badge :tone="m.status === 'sent' ? 'ok' : 'bad'">{{ m.status === "sent" ? "Sent" : "Failed" }}</Badge><span>{{ MAIL_LABEL[m.kind] }} · {{ fmtDateTime(m.sent_at) }}{{ m.error ? ` · ${m.error}` : "" }}</span></li></ul>
      </section>
      <Field id="admin_note" v-slot="a" label="Note (only admins see this)"><textarea v-bind="a" v-model="note" class="input" rows="2" /></Field>
      <div class="sheet-actions flex flex-wrap justify-end gap-2 border-t border-brand-sky">
        <button type="button" class="btn-secondary" @click="emit('close')"><IconClose />Close</button>
        <button v-for="[s, label, icon] in next" :key="s" type="button" :class="s === 'cancelled' ? 'btn-danger' : 'btn-primary'" :disabled="busy || (s === 'shipped' && !shipOk) || (s === 'paid' && balanceOpen)" @click="setStatus(s)"><component :is="icon" />{{ label }}</button>
      </div>
    </div>
  </Modal>
</template>
