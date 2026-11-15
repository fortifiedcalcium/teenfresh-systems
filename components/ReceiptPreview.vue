<script setup lang="ts">
import type { PropType } from "vue";
const props = defineProps({ file: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const url = ref(null);
watch(() => props.file, (file, _o, onCleanup) => {
  if (!file.type.startsWith("image/")) { url.value = null; return; }
  const u = URL.createObjectURL(file as Blob);
  url.value = u;
  onCleanup(() => URL.revokeObjectURL(u));
}, { immediate: true });
</script>

<template>
  <figure v-if="url"><img :src="url" :alt="`Preview of your receipt, ${file.name}`" class="mx-auto max-h-72 rounded-lg border border-link"><figcaption class="mt-1 text-center text-sm text-ink-muted">Receipt preview</figcaption></figure>
  <p v-else class="text-sm text-ink-muted">Receipt: {{ file.name }} (PDF, no preview).</p>
</template>
