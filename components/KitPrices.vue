<script setup lang="ts">
import type { PropType } from "vue";
import { priceBounds } from "~/lib/payment";

// "₱100.00 each", "₱100.00 to ₱250.00 each" (wraps only at "to"), or just "₱100.00" for a single kit
const props = defineProps({ kits: { type: Array as PropType<any[]> as PropType<any[]>, default: () => [] } });
const b = computed(() => priceBounds(props.kits));
</script>

<template>
  <template v-if="b">
    <NoWrap v-if="kits.length === 1">{{ b.lo }}</NoWrap>
    <template v-else-if="b.hi"><NoWrap>{{ b.lo }}</NoWrap> to <NoWrap>{{ b.hi }} each</NoWrap></template>
    <NoWrap v-else>{{ b.lo }} each</NoWrap>
  </template>
</template>
