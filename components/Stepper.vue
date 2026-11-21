<script setup lang="ts">
import type { PropType } from "vue";
// A labelled ordered list of the form's steps. The current step has aria-current="step".
defineProps({ steps: { type: Array as PropType<any[]> as PropType<any[]>, required: true }, current: { type: Number, required: true } });
const stateOf = (i, current) => (i < current ? "completed" : i === current ? "current" : "upcoming");
</script>

<template>
  <nav aria-label="Registration progress" class="card-soft reg-steps">
    <ol>
      <li v-for="(s, i) in steps" :key="s.key" :class="stateOf(i, current) === 'completed' ? 'is-done' : ''" :aria-current="stateOf(i, current) === 'current' ? 'step' : undefined">
        <span aria-hidden="true" class="reg-steps__num">{{ stateOf(i, current) === "completed" ? "✓" : i + 1 }}</span>
        <span :class="stateOf(i, current) === 'current' ? 'font-black' : 'text-ink-muted font-bold'">
          <span class="sr-only">Step {{ Number(i) + 1 }} of {{ steps.length }}: </span>{{ s.label }}{{ " " }}<span class="sr-only">({{ stateOf(i, current) }})</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
