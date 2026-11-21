<script setup lang="ts">
import { GROUPS } from "~/lib/adminNav";

// The pages of one sidebar group, as a pill switch under the page title (same look as the To review / All / Verified switch on Payments).
// Plain links, so each page keeps its own address; the current one has aria-current="page". A group with one page shows nothing.
const props = defineProps({ group: { type: String, required: true } });
const route = useRoute();
const pages = computed(() => GROUPS.find((g) => g.key === props.group)?.pages || []);
const here = (to: string) => route.path === to || route.path.startsWith(to + "/");
</script>

<template>
  <nav v-if="pages.length > 1" :aria-label="`${group} pages`" class="admin-switch">
    <NuxtLink v-for="[to, label] in pages" :key="to" :to="to" class="no-underline" :aria-current="here(to) ? 'page' : undefined">{{ label }}</NuxtLink>
  </nav>
</template>
