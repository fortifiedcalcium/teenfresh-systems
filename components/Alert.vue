<script setup>
// tone: bad | warn | ok | info. Colour + icon + text; announced to screen readers.
defineProps({ tone: { type: String, default: "info" }, live: { type: Boolean, default: true } });
const ROLE = { bad: "alert", warn: "status", ok: "status", info: "status" };
</script>

<template>
  <div :role="live ? ROLE[tone] : undefined" :class="['alert', `alert-${tone}`]"><div class="min-w-0 flex-1"><slot /></div></div>
</template>
