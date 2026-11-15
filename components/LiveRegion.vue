<script setup lang="ts">
import type { PropType } from "vue";
// Visible-or-hidden status text that screen readers announce when it changes.
defineProps({ level: { type: String as PropType<"polite" | "assertive">, default: "polite" } });
</script>

<template>
  <div :class="$attrs.class ? '' : 'sr-only'" :role="level === 'assertive' ? 'alert' : 'status'" :aria-live="level" aria-atomic="true"><slot /></div>
</template>
