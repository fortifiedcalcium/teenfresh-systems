<script setup lang="ts">
// tone: ok | warn | bad | info | neutral. Every badge shows an icon, text and colour (1.4.1).
// The icon is a symbol drawn by the CSS for the tone; use the `icon` slot to use a picture instead.
defineProps({ tone: { type: String, default: "neutral" }, title: { type: String, default: undefined } });
const slots = useSlots();
</script>

<template>
  <span :class="['badge', `badge-${tone}`, slots.icon ? 'badge-has-icon' : '']" :title="title"><slot name="icon" /><slot /></span>
</template>
