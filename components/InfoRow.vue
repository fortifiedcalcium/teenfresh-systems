<script setup>
// One fact: an icon (slot `icon`) plus ONE text block ("Label: value"), top-aligned, so a row that wraps keeps the icon and the label on its
// first line and the wrapped text starts under the left edge of the text block. `note` goes on its own muted line.
defineProps({ label: String, note: String });
</script>

<template>
  <li class="info-row">
    <span class="info-icon" aria-hidden="true"><slot name="icon" /></span>
    <p class="info-text">
      <strong>{{ label }}</strong>{{ " " }}<slot />
      <span v-if="note" class="info-note">{{ note }}</span>
    </p>
  </li>
</template>
