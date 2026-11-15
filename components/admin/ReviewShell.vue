<script setup lang="ts">
// The review opens as a dialog (a full-screen sheet on phones). From 768px it is shown beside the list instead (master-detail).
defineProps({ inline: Boolean, title: String });
const emit = defineEmits(["close"]);
</script>

<template>
  <section v-if="inline" :aria-label="title" class="card p-4">
    <div class="mb-3 flex items-start justify-between gap-2"><h2 class="text-lg font-black">{{ title }}</h2><button type="button" class="btn-secondary" aria-label="Close review" @click="emit('close')"><IconClose /></button></div>
    <slot />
  </section>
  <Modal v-else :title="title" wide @close="emit('close')"><slot /></Modal>
</template>
