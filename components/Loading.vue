<script setup>
import logoImg from "~/assets/logo/teenfresh-logo.png";

// Spinner + visible text; the text is the accessible name, so reduced-motion users still see "Loading…".
// `logo` makes it a loading screen: the Teenfresh logo (it pulses gently, and stands still for people who ask for less motion)
// above the spinner. The logo is decorative: the text already says what is happening.
defineProps({ label: { type: String, default: "Loading…" }, logo: Boolean });
</script>

<template>
  <div role="status" :class="['flex', logo ? 'flex-col' : '', 'items-center justify-center gap-3 text-ink-muted', $attrs.class ? '' : 'p-10']">
    <img v-if="logo" :src="logoImg" alt="" width="188" height="40" class="mb-2 h-10 w-auto motion-safe:animate-pulse">
    <span class="flex items-center gap-3"><Spinner /> <span>{{ label }}</span></span>
  </div>
</template>
