<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { friendlyError } from "~/lib/api";
import { isValidReference, normalizeReference, peso, receiptPath, validateReceiptFile } from "~/lib/payment";
import { productImageUrl } from "~/lib/products";

// The shipping fee an admin set for a confirmed order, and the form to pay it by GCash with a receipt.
// Shown on the order page while order.shipping_status is "awaiting_payment".
const props = defineProps({ order: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["sent"]);
const { user } = useAuth();
const settings = useShopSettings();
const sender = ref("");
const reference = ref("");
const file = ref(null);
const errors = ref<Record<string, string>>({});
const serverError = ref("");
const busy = ref(false);
const qr = computed(() => (settings.value?.gcash_qr_path ? productImageUrl({ image_path: settings.value.gcash_qr_path }) : null));

async function submit() {
  serverError.value = "";
  const errs: Record<string, string> = {};
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
    const { error } = await supabase.rpc("submit_shipping_payment", { p_order: props.order.id, p_sender: sender.value.trim(), p_reference: normalizeReference(reference.value), p_receipt_path: path });
    if (error) throw error;
    emit("sent");
  } catch (e) {
    if (path) supabase.storage.from("payment-receipts").remove([path]);      // do not leave an unused receipt behind
    serverError.value = friendlyError(e); busy.value = false;
  }
}
</script>

<template>
  <section class="card space-y-4 p-4" aria-labelledby="shippay-h">
    <h2 id="shippay-h" class="text-lg font-black">Pay your shipping fee</h2>
    <Alert v-if="order.shipping_note" tone="warn"><span><strong>Your last shipping receipt was sent back.</strong> {{ order.shipping_note }} Please pay again or upload a clearer receipt.</span></Alert>
    <div class="rounded-lg bg-brand-sky p-3 text-sm">
      <p>Send <strong>{{ peso(order.shipping_fee_php) }}</strong> to:</p>
      <template v-if="settings?.gcash_account_number">
        <p class="mt-1 font-bold">{{ settings.gcash_account_name || "Teenfresh" }}</p>
        <p class="flex flex-wrap items-center gap-2"><span class="font-mono text-base font-bold">{{ settings.gcash_account_number }}</span><CopyButton :text="settings.gcash_account_number" label="Copy GCash number" /></p>
      </template>
      <figure v-if="qr" class="mt-3 w-48 max-w-full">
        <img :src="qr" :alt="`GCash QR code for ${settings.gcash_account_name || 'Teenfresh'}. Scan it in the GCash app to pay.`" class="w-full rounded-lg border border-link bg-white">
        <figcaption class="mt-1 text-sm">Or scan this QR code in the GCash app.</figcaption>
      </figure>
      <p class="mt-2">Then enter the details below and attach your receipt. We ship your order once the shipping fee is confirmed.</p>
    </div>
    <Alert v-if="serverError" tone="bad">{{ serverError }}</Alert>
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <Field id="ship_sender" v-slot="a" label="GCash sender name" required :error="errors.sender" hint="The name on the account you paid from"><input v-bind="a" v-model="sender" class="input"></Field>
        <Field id="ship_reference" v-slot="a" label="Reference number" required :error="errors.reference"><input v-bind="a" v-model="reference" class="input" autocomplete="off"></Field>
      </div>
      <FileUpload id="ship_receipt" v-model="file" :error="errors.receipt" />
      <div class="flex justify-end"><button class="btn-primary" :disabled="busy"><IconSend />{{ busy ? "Sending…" : "Send shipping receipt" }}</button></div>
    </form>
  </section>
</template>
