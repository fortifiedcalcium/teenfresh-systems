<script setup>
// The admin area: admins only, inside the admin layout. The real protection is Row Level Security in the database.
definePageMeta({ layout: "admin", middleware: ["admin"] });
</script>

<template><NuxtPage /></template>
