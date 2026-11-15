<script setup>
import { sanitize } from "~/lib/sanitize.js";

// Admin-edited HTML (the Terms) is always passed through a whitelist sanitizer before it is rendered.
const props = defineProps({ html: String });
const clean = computed(() => sanitize(props.html));
</script>

<template>
  <!-- The HTML is sanitized above, so injecting it is safe. -->
  <div class="safe-html" v-html="clean" />
</template>
