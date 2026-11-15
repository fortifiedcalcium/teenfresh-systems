<script setup>
import { productImageUrl } from "~/lib/products.js";

const props = defineProps({ p: { type: Object, required: true } });
const src = computed(() => productImageUrl(props.p));
</script>

<template>
  <img v-if="src" :src="src" alt="" class="h-20 w-20 shrink-0 rounded-xl border border-link object-cover">
  <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-link bg-brand-ivory text-link" aria-hidden="true"><IconImage /></div>
</template>
