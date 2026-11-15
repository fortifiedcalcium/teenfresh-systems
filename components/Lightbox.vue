<script setup lang="ts">
// Accessible lightbox: focus is trapped, Esc closes, focus returns to the thumbnail (see Modal). Posters contain
// small text, so there is always a download link as well.
defineProps({ url: String, alt: String, title: String });
const emit = defineEmits(["close"]);
</script>

<template>
  <Modal :title="title" wide @close="emit('close')">
    <img :src="url" :alt="alt" class="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg">
    <p class="mt-3 text-center"><a :href="url" download target="_blank" rel="noopener noreferrer">Download image</a></p>
  </Modal>
</template>
