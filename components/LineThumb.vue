<script setup lang="ts">
import type { PropType } from "vue";
import { productImageUrl } from "~/lib/products";

const props = defineProps({ p: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const src = computed(() => productImageUrl(props.p));
</script>

<template>
  <img v-if="src" :src="src" alt="" class="h-20 w-20 shrink-0 rounded-xl border border-link object-cover">
  <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-link bg-brand-ivory text-link" aria-hidden="true"><IconImage /></div>
</template>
