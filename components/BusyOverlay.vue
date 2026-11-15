<script setup lang="ts">
// A screen over the whole page while something that must not be interrupted is running (for example sending an email).
// It blocks clicks, tells screen readers what is happening, and warns before the tab is closed or reloaded.
const props = defineProps({ show: Boolean, label: { type: String, default: "Please wait…" } });
const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
watch(() => props.show, (on) => { if (on) window.addEventListener("beforeunload", warn); else window.removeEventListener("beforeunload", warn); }, { immediate: true });
onBeforeUnmount(() => window.removeEventListener("beforeunload", warn));
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="busy-overlay" aria-busy="true">
      <div class="busy-card">
        <Loading :label="label" class="p-0 text-ink" />
        <p class="mt-2 text-sm text-ink-muted">Please wait. Do not close or leave this page.</p>
      </div>
    </div>
  </Teleport>
</template>
