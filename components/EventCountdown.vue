<script setup lang="ts">
import type { PropType } from "vue";

// A countdown to the event's start, as four little sticker tiles (days, hours, minutes, seconds). Once the event has started it says
// "Happening now" until its end time (if it has one); after that it shows nothing. It only runs in the browser (the server cannot know "now"),
// so nothing is drawn until the page is ready, which also avoids a mismatch between the server's page and the browser's.
// Screen readers get one plain sentence that changes once a minute, not a tick every second.
const props = defineProps({ event: { type: Object as PropType<Record<string, any>>, required: true } });
const now = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));

const start = computed(() => new Date(props.event.event_date).getTime());
const end = computed(() => (props.event.ends_at ? new Date(props.event.ends_at).getTime() : 0));
const left = computed(() => Math.max(start.value - now.value, 0));
const state = computed(() => (!now.value ? "wait" : now.value < start.value ? "before" : end.value && now.value < end.value ? "live" : "over"));
const parts = computed(() => {
  const s = Math.floor(left.value / 1000);
  return [["Days", Math.floor(s / 86400)], ["Hours", Math.floor((s % 86400) / 3600)], ["Min", Math.floor((s % 3600) / 60)], ["Sec", s % 60]] as [string, number][];
});
const pad = (n: number) => String(n).padStart(2, "0");
// updated once a minute for assistive technology
const spoken = ref("");
watch(() => Math.floor(left.value / 60000), () => {
  const [d, h, m] = parts.value.map(([, n]) => n);
  spoken.value = `Starts in ${d} day${d === 1 ? "" : "s"}, ${h} hour${h === 1 ? "" : "s"} and ${m} minute${m === 1 ? "" : "s"}`;
}, { immediate: true });
</script>

<template>
  <div v-if="state === 'before'" class="cd" role="group" aria-label="Countdown to the event">
    <p class="cd__label" aria-hidden="true">Starts in</p>
    <ol class="cd__tiles" aria-hidden="true">
      <li v-for="[label, n] in parts" :key="label" class="cd__tile"><strong>{{ label === "Days" ? n : pad(n) }}</strong><span>{{ label }}</span></li>
    </ol>
    <p class="sr-only">{{ spoken }}</p>
  </div>
  <p v-else-if="state === 'live'" class="cd cd--live" role="status"><span class="cd__dot" aria-hidden="true" />Happening now</p>
</template>
