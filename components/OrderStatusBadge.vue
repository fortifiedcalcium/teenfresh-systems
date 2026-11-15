<script setup>
import { STATUS, displayStatus } from "~/lib/orders.js";

// The status of a shop order as a badge. It says "Paid" only once everything is paid, shipping fee included; Shipped shows a delivery truck.
const props = defineProps({ order: { type: Object, required: true } });
const key = computed(() => displayStatus(props.order));
const st = computed(() => STATUS[key.value] || STATUS.pending);
</script>

<template>
  <Badge :tone="st.tone"><template v-if="key === 'shipped'" #icon><IconTruck /></template>{{ st.label }}</Badge>
</template>
