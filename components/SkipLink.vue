<script setup lang="ts">
// First tab stop. Focus is moved explicitly (not left to the browser's fragment handling) so it works in every browser and in the SPA router.
function skip(e) { e.preventDefault(); const m = document.getElementById("main-content"); m?.focus(); m?.scrollIntoView(); }
</script>

<template>
  <a href="#main-content" class="skip-link" @click="skip">Skip to main content</a>
</template>
