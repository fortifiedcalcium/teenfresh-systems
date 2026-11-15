<script setup lang="ts">
// Old address: the shop order emails live on the Email page now.
await navigateTo({ path: "/admin/emails", query: { tab: "shop" } }, { replace: true });
</script>

<template><div /></template>
