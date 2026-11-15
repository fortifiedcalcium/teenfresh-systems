<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { friendlyError } from "~/lib/api.js";
import { isValidReference, normalizeReference, peso, receiptPath, validateReceiptFile } from "~/lib/payment.js";
import { productImageUrl } from "~/lib/products.js";

// The shopper paid less than the order asks for. They see how much is missing and send a receipt for just that amount.
const props = defineProps({ order: { type: Object, required: true } });
const emit = defineEmits(["sent"]);
const { user } = useAuth();
const settings = useShopSettings();
const sender = ref("");
const reference = ref("");
const file = ref(null);
const errors = ref({});
const serverError = ref("");
const busy = ref(false);
const what = computed(() => (props.order.balance_for === "shipping" ? "shipping fee" : "order"));
const qr = computed(() => (settings.value?.gcash_qr_path ? productImageUrl({ image_path: settings.value.gcash_qr_path }) : null));

async function submit() {
  serverError.value = "";
  const errs = {};
  if (!sender.value.trim()) errs.sender = "Enter the name on the GCash account you paid from";
  if (!isValidReference(reference.value)) errs.reference = "Enter the reference number exactly as GCash shows it";
  const fileProblem = validateReceiptFile(file.value);
  if (fileProblem) errs.receipt = fileProblem;
  errors.value = errs;
  if (Object.keys(errs).length) return;
  busy.value = true;
  let path = null;
  try {
    path = receiptPath(user.value.id, file.value);
    const up = await supabase.storage.from("payment-receipts").upload(path, file.value, { contentType: file.value.type, upsert: false });
    if (up.error) throw new Error("We couldn't upload your receipt. Check your connection and the file, then try again.");
    const { error } = await supabase.rpc("submit_balance_payment", { p_order: props.order.id, p_sender: sender.value.trim(), p_reference: normalizeReference(reference.value), p_receipt_path: path });
    if (error) throw error;
    emit("sent");
  } catch (e) {
    if (path) supabase.storage.from("payment-receipts").remove([path]);      // do not leave an unused receipt behind
    serverError.value = friendlyError(e); busy.value = false;
  }
}
</script>

<template>
  <section class="card space-y-4 p-4" aria-labelledby="balance-h">
    <h2 id="balance-h" class="text-lg font-black">Your payment was short: send the remaining {{ peso(order.balance_due_php) }}</h2>
    <Alert tone="warn"><span>We received less than the total for your {{ what }}. <strong>Send only the missing {{ peso(order.balance_due_php) }}</strong> by GCash. You do not need to pay the full amount again.<template v-if="order.balance_note"> <span class="font-semibold">Note from us:</span> {{ order.balance_note }}</template></span></Alert>
    <div class="rounded-lg bg-brand-sky p-3 text-sm">
      <p>Send <strong>{{ peso(order.balance_due_php) }}</strong> to:</p>
      <template v-if="settings?.gcash_account_number">
        <p class="mt-1 font-bold">{{ settings.gcash_account_name || "Teenfresh" }}</p>
        <p class="flex flex-wrap items-center gap-2"><span class="font-mono text-base font-bold">{{ settings.gcash_account_number }}</span><CopyButton :text="settings.gcash_account_number" label="Copy GCash number" /></p>
      </template>
      <figure v-if="qr" class="mt-3 w-48 max-w-full">
        <img :src="qr" :alt="`GCash QR code for ${settings.gcash_account_name || 'Teenfresh'}. Scan it in the GCash app to pay.`" class="w-full rounded-lg border border-link bg-white">
        <figcaption class="mt-1 text-sm">Or scan this QR code in the GCash app.</figcaption>
      </figure>
      <p class="mt-2">Then enter the details below and attach the receipt for this extra payment.</p>
    </div>
    <Alert v-if="serverError" tone="bad">{{ serverError }}</Alert>
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <Field id="bal_sender" v-slot="a" label="GCash sender name" required :error="errors.sender" hint="The name on the account you paid from"><input v-bind="a" v-model="sender" class="input"></Field>
        <Field id="bal_reference" v-slot="a" label="Reference number" required :error="errors.reference"><input v-bind="a" v-model="reference" class="input" autocomplete="off"></Field>
      </div>
      <FileUpload id="bal_receipt" v-model="file" :error="errors.receipt" />
      <div class="flex justify-end"><button class="btn-primary" :disabled="busy"><IconSend />{{ busy ? "Sending…" : "Send the extra payment" }}</button></div>
    </form>
  </section>
</template>
