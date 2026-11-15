<script setup>
import { supabase } from "~/lib/supabaseClient.js";

// A receipt from the private bucket through a short-lived signed URL.
const props = defineProps({ path: { type: String, required: true }, label: { type: String, default: "Payment receipt" } });
const url = ref(null);
const err = ref("");
watch(() => props.path, (path, _o, onCleanup) => {
  let alive = true;
  onCleanup(() => { alive = false; });
  url.value = null; err.value = "";
  supabase.storage.from("payment-receipts").createSignedUrl(path, 300).then(({ data, error }) => { if (!alive) return; if (error) err.value = "Could not open this receipt."; else url.value = data.signedUrl; });
}, { immediate: true });
</script>

<template>
  <p v-if="err" class="text-sm font-semibold text-danger">{{ err }}</p>
  <Loading v-else-if="!url" label="Loading receipt…" class="p-4" />
  <figure v-else class="space-y-2">
    <p v-if="/\.pdf$/i.test(path)" class="rounded-lg bg-brand-sky p-3 text-sm font-semibold">PDF receipt: open it in a new tab to read it.</p>
    <img v-else :src="url" :alt="label" class="mx-auto max-h-96 rounded-lg border border-link object-contain">
    <figcaption class="text-sm"><a :href="url" target="_blank" rel="noopener noreferrer">Open the receipt in a new tab <span class="sr-only">(link expires in 5 minutes)</span></a></figcaption>
  </figure>
</template>
