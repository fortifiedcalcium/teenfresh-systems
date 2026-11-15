<script setup lang="ts">
defineProps({ sizeClass: { type: String, default: "h-5 w-5" } });
</script>

<template>
  <span aria-hidden="true" :class="`inline-block animate-spin rounded-full border-2 border-brand-sky border-t-link ${sizeClass}`" />
</template>
