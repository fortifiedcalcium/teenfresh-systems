<script setup>
const { polite, assertive } = useAnnounceState();
</script>

<template>
  <div>
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ polite }}</div>
    <div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{{ assertive }}</div>
  </div>
</template>
