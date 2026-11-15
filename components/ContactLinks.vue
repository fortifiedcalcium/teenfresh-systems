<script setup>
import { contactLinkList } from "~/lib/contactLinks.js";

// The event's contact links (Facebook, X, Instagram, TikTok, Gmail ...). Only http(s) and mailto links are shown.
const props = defineProps({ links: { type: Array, default: () => [] } });
const list = computed(() => contactLinkList(props.links));
const mail = (u) => u.startsWith("mailto:");
</script>

<template>
  <ul v-if="list.length" class="mt-1 flex flex-wrap gap-x-5" aria-label="Contact links">
    <li v-for="l in list" :key="l.label"><a :href="l.url" v-bind="mail(l.url) ? {} : { target: '_blank', rel: 'noopener noreferrer' }" class="inline-flex min-h-target items-center">{{ l.label }}<template v-if="!mail(l.url)"> <span class="sr-only">(opens in a new tab)</span></template></a></li>
  </ul>
</template>
