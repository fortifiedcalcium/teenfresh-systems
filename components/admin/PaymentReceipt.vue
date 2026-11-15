<script setup>
import { supabase } from "~/lib/supabaseClient.js";

// A receipt from the private bucket, shown through a short-lived signed URL
const props = defineProps({ path: { type: String, required: true }, label: String });
const url = ref(null);
const err = ref("");
const zoom = ref(false);
watch(() => props.path, (path, _o, onCleanup) => {
  let alive = true;
  onCleanup(() => { alive = false; });
  url.value = null; err.value = "";
  supabase.storage.from("payment-receipts").createSignedUrl(path, 300).then(({ data, error }) => { if (!alive) return; if (error) err.value = "Could not open this receipt."; else url.value = data.signedUrl; });
}, { immediate: true });
const isPdf = computed(() => /\.pdf$/i.test(props.path));
</script>

<template>
  <p v-if="err" class="text-sm font-semibold text-danger">{{ err }}</p>
  <Loading v-else-if="!url" label="Loading receipt…" class="p-4" />
  <figure v-else class="space-y-2">
    <p v-if="isPdf" class="rounded-lg bg-brand-sky p-4 text-sm font-semibold">PDF receipt: open it in a new tab to read it.</p>
    <button v-else type="button" class="block w-full" :aria-label="`Zoom in: ${label}`" @click="zoom = true"><img :src="url" :alt="label" class="mx-auto max-h-96 rounded-lg border border-link object-contain"></button>
    <figcaption class="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{{ label }}</span><a :href="url" target="_blank" rel="noopener noreferrer">Open in a new tab <span class="sr-only">(link expires in 5 minutes)</span></a></figcaption>
    <Lightbox v-if="zoom" :url="url" :alt="label" title="Payment receipt" @close="zoom = false" />
  </figure>
</template>
