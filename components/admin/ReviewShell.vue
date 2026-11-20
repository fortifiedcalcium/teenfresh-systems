<script setup lang="ts">
// The review opens as a dialog (a full-screen sheet on phones). From 768px it is shown beside the list instead (master-detail).
// Beside the list it has a plain heading and a subtitle, and no close button: the list always has one row selected.
defineProps({ inline: Boolean, title: String, heading: { type: String, default: "Review payment" }, subtitle: { type: String, default: "" } });
const emit = defineEmits(["close"]);
</script>

<template>
  <section v-if="inline" :aria-label="title" class="pay-review">
    <h2 class="pay-review__title">{{ heading }}</h2>
    <p v-if="subtitle" class="pay-review__sub">{{ subtitle }}</p>
    <slot />
  </section>
  <Modal v-else :title="title" wide @close="emit('close')"><slot /></Modal>
</template>
