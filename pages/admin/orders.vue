<script setup>
// Old address: the shop orders live on the Payments page now.
await navigateTo({ path: "/admin/payments", query: { tab: "shop" } }, { replace: true });
</script>

<template><div /></template>
