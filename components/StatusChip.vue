<script setup lang="ts">
import type { Tone } from "~/types/ui";

// A pastel status chip. Colour is never the only cue: every chip carries a text label (and the CSS draws a symbol for ok/warn/bad/info).
const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: "neutral" });
const BADGE: Record<Tone, string> = { ok: "badge-ok", warn: "badge-warn", bad: "badge-bad", info: "badge-info", neutral: "badge-neutral", new: "badge-info", popular: "badge-warn", low: "badge-bad" };
const cls = computed(() => `badge ${BADGE[props.tone]}`);
</script>

<template><span :class="cls"><slot /></span></template>
