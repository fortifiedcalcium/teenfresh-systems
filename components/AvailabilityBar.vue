<script setup lang="ts">
// Track = sky, fill = link (3:1+ non-text contrast). Not the only cue: the card always prints "X of Y slots left".
const props = defineProps({ registered: { type: Number, required: true }, capacity: { type: Number, required: true }, label: { type: String, default: "Slots taken" } });
const taken = computed(() => Math.min(props.registered, props.capacity));
const pct = computed(() => Math.round((taken.value / props.capacity) * 100));
</script>

<template>
  <div role="progressbar" :aria-valuemin="0" :aria-valuemax="capacity" :aria-valuenow="taken" :aria-valuetext="`${taken} of ${capacity} slots taken`" :aria-label="label" class="progress-track h-3 w-full overflow-hidden rounded-full bg-brand-sky">
    <div class="progress-fill h-full rounded-full bg-link transition-all duration-500" :style="{ width: `${pct}%` }" />
  </div>
</template>
