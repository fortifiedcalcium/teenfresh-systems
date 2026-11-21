<script setup lang="ts">
// Event payments. Shop orders moved to Shop > Orders, so an old ?tab=shop link is sent there.
if (useRoute().query.tab === "shop") await navigateTo("/admin/orders", { replace: true });
</script>

<template>
  <EventPayments />
</template>
