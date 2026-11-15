<script setup lang="ts">
import { sanitize } from "~/lib/sanitize";

// Admin-edited HTML (the Terms) is always passed through a whitelist sanitizer before it is rendered.
const props = defineProps({ html: String });
const clean = computed(() => sanitize(props.html));
</script>

<template>
  <!-- The HTML is sanitized above, so injecting it is safe. -->
  <!-- the sanitizer needs a browser DOM, so this is drawn in the browser only (never on the server) -->
  <ClientOnly><div class="safe-html" v-html="clean" /></ClientOnly>
</template>
