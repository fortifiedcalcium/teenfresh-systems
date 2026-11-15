<script setup lang="ts">
// The stub's small heading, and its content. Put the button(s) in <TicketAction>: it sits on the bottom line of the stub.
defineProps({ label: String });
</script>

<template>
  <p v-if="label" class="ticket__label">{{ label }}</p>
  <slot />
</template>
