<script setup lang="ts">
import type { PropType } from "vue";
// A labelled ordered list of the form's steps. The current step has aria-current="step".
defineProps({ steps: { type: Array as PropType<any[]> as PropType<any[]>, required: true }, current: { type: Number, required: true } });
const stateOf = (i, current) => (i < current ? "completed" : i === current ? "current" : "upcoming");
</script>

<template>
  <nav aria-label="Registration progress">
    <ol class="flex flex-wrap gap-x-4 gap-y-2">
      <li v-for="(s, i) in steps" :key="s.key" :aria-current="stateOf(i, current) === 'current' ? 'step' : undefined" class="flex min-h-target items-center gap-2 text-sm">
        <span aria-hidden="true" :class="['flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-bold', stateOf(i, current) === 'current' ? 'border-ink bg-ink text-brand-ivory' : stateOf(i, current) === 'completed' ? 'border-success bg-brand-mint text-success' : 'border-link bg-white text-ink']">{{ stateOf(i, current) === "completed" ? "✓" : i + 1 }}</span>
        <span :class="stateOf(i, current) === 'current' ? 'font-bold' : 'text-ink-muted'">
          <span class="sr-only">Step {{ Number(i) + 1 }} of {{ steps.length }}: </span>{{ s.label }}{{ " " }}<span class="sr-only">({{ stateOf(i, current) }})</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
