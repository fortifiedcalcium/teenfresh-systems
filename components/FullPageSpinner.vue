<script setup lang="ts">
defineProps({ label: { type: String, default: "Loading…" } });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center"><Loading :label="label" logo /></div>
</template>
