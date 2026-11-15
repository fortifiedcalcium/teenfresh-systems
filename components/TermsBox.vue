<script setup>
// The Terms (events.terms_html, sanitized) behind a real button with aria-expanded.
const props = defineProps({ event: Object, defaultOpen: Boolean });
const open = ref(props.defaultOpen);
const id = `terms-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <section v-if="event?.terms_html" class="rounded-lg border border-link bg-brand-ivory p-3 text-sm" aria-label="Terms and Conditions">
    <button type="button" class="btn-secondary w-full justify-between" :aria-expanded="open" :aria-controls="id" @click="open = !open">
      <span>{{ open ? "Hide" : "Read" }} the Terms and Conditions</span><IconChevronUp v-if="open" /><IconChevronDown v-else />
    </button>
    <div :id="id" :hidden="!open" class="mt-3 border-l-4 border-link pl-4"><SafeHtml :html="event.terms_html" /></div>
  </section>
</template>
