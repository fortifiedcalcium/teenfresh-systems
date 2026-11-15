<script setup lang="ts">
import type { PropType } from "vue";
// Bar chart: bars are `link` or `brand-blue` + a 2px ink outline (3:1 non-text contrast), every bar prints its value,
// and a real table below carries the same data for screen readers (1.1.1 / 1.4.11).
const props = defineProps({ data: { type: Array as PropType<any[]> as PropType<any[]>, required: true }, title: String, fill: String });
const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)));
</script>

<template>
  <figure>
    <div class="flex h-36 items-end gap-1" aria-hidden="true">
      <div v-for="d in data" :key="d.label" class="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
        <span class="text-xs font-bold">{{ d.value || "" }}</span>
        <div :class="['chart-bar w-full rounded-t', d.value ? `border-2 border-ink ${fill}` : 'border-b-2 border-ink']" :style="{ height: `${(d.value / max) * 85}%`, minHeight: d.value ? '4px' : '0' }" />
      </div>
    </div>
    <div class="mt-1 flex gap-1 text-xs text-ink-muted" aria-hidden="true"><span v-for="(d, i) in data" :key="d.label" class="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{{ data.length > 8 && i % 4 ? "" : d.label }}</span></div>
    <details class="mt-3 text-sm">
      <summary class="inline-flex min-h-target items-center font-semibold text-link underline">View data table</summary>
      <div class="overflow-x-auto"><table class="mt-2 w-full">
        <caption class="sr-only">{{ title }}</caption>
        <thead><tr><th scope="col" class="th">Period</th><th scope="col" class="th">Count</th></tr></thead>
        <tbody><tr v-for="d in data" :key="d.label"><th scope="row" class="td text-left font-normal">{{ d.label }}</th><td class="td">{{ d.value }}</td></tr></tbody>
      </table></div>
    </details>
  </figure>
</template>
