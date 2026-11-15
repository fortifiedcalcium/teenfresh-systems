<script setup lang="ts">
import type { PropType } from "vue";
import { fetchEventImages, SLOT_KEYS } from "~/lib/eventImages";

const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["eventChanged"]);
const rows = ref(null);
async function reload() { rows.value = await fetchEventImages(props.event.id); }
watch(() => props.event.id, reload, { immediate: true });
</script>

<template>
  <Loading v-if="!rows" label="Loading images…" />
  <div v-else class="space-y-3">
    <p class="text-sm text-ink-muted">Replace any image here at any time. Changes show up straight away; no redeploy is needed. Until an image is uploaded, a placeholder is shown.</p>
    <ul class="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><SlotCard v-for="s in SLOT_KEYS" :key="s" :event="event" :slot-key="s" :row="rows[s]" @reload="reload" @event-changed="emit('eventChanged')" /></ul>
  </div>
</template>
