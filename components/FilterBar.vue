<script setup lang="ts">
import { MEDIA } from "~/lib/breakpoints";

// The search field (slot `search`) plus the filters (default slot). From 768px the filters sit inline next to the search; below that they collapse into a
// bottom sheet behind a "Filter (n)" button (n = how many filters are active), and the search stays sticky under the top bar.
defineProps({ activeCount: { type: Number, default: 0 } });
const mobile = useMediaQuery(MEDIA.mobile);
const open = ref(false);
</script>

<template>
  <div class="sticky top-[calc(var(--topbar-h)+var(--safe-top))] z-10 -mx-4 flex flex-wrap items-center gap-2 bg-brand-blush px-4 py-2 sm:-mx-5 sm:px-5 md:static md:mx-0 md:bg-transparent md:p-0 lg:top-0">
    <div class="min-w-0 flex-1 md:flex-none"><slot name="search" /></div>
    <template v-if="mobile">
      <button type="button" class="btn-secondary" aria-haspopup="dialog" @click="open = true">
        <IconFilter />Filter<span v-if="activeCount > 0" class="rounded-full bg-ink px-2 text-xs text-brand-ivory"><span aria-hidden="true">{{ activeCount }}</span><span class="sr-only"> ({{ activeCount }} active)</span></span>
      </button>
      <Modal v-if="open" title="Filters" @close="open = false">
        <div class="flex flex-col gap-3 [&_.input]:max-w-none"><slot /></div>
        <div class="mt-5 flex justify-end"><button type="button" class="btn-primary" @click="open = false"><IconCheck />Show results</button></div>
      </Modal>
    </template>
    <slot v-else />
  </div>
</template>
