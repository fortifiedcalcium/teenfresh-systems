<script setup lang="ts">
const items = useToastItems();
const dismiss = (id) => { items.value = items.value.filter((t) => t.id !== id); };
// White card, ink text, 4px status bar + icon. Each toast is its own live region.
const TONE = {
  info: { bar: "border-l-link", icon: "i", label: "Info" },
  success: { bar: "border-l-success", icon: "✓", label: "Success" },
  error: { bar: "border-l-danger", icon: "✕", label: "Error" },
};
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
    <div v-for="t in items" :key="t.id" :role="t.type === 'error' ? 'alert' : 'status'" :class="`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-link border-l-4 bg-white p-3 text-sm text-ink shadow-lg ${TONE[t.type].bar}`">
      <span aria-hidden="true" class="font-extrabold">{{ TONE[t.type].icon }}</span>
      <p class="flex-1"><span class="sr-only">{{ TONE[t.type].label }}:</span>{{ " " }}{{ t.message }}</p>
      <button type="button" class="inline-flex min-h-target min-w-target items-center justify-center rounded font-bold hover:bg-brand-sky" aria-label="Dismiss notification" @click="dismiss(t.id)"><IconClose /></button>
    </div>
  </div>
</template>
