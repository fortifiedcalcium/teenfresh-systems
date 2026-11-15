<script setup lang="ts">
// The centre scan button. Raised (protruding about half above the bar) everywhere except the Scanner page, where it is
// docked inside the bar; the nav's data-docked attribute drives the 180 ms move (CSS, off with reduced motion).
// Round hit area only: it is a circle, so it never covers the neighbouring tabs.
defineProps({ to: String, label: String, active: Boolean });
const emit = defineEmits(["activeClick"]);
</script>

<template>
  <li class="scan-fab-slot">
    <NuxtLink :to="to" class="scan-fab" :aria-label="label" :title="label" :aria-current="active ? 'page' : undefined" @click="(e) => { if (active) { e.preventDefault(); emit('activeClick'); } }">
      <IconScanLine />
    </NuxtLink>
  </li>
</template>
