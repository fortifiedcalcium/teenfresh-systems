<script setup lang="ts">
import type { CartStubLine } from "~/types/ui";

// The cart as a ticket stub: the lines on the left, a perforated edge, the summary (slot) on the right.
defineProps<{ lines: CartStubLine[] }>();
</script>

<template>
  <section class="cstub grid gap-0 md:grid-cols-[1fr_20rem]" aria-label="Your cart">
    <ul class="space-y-3 p-5">
      <li v-for="l in lines" :key="l.key" class="flex items-center justify-between gap-3">
        <span class="min-w-0"><span class="block break-words font-bold">{{ l.title }}</span><span v-if="l.subtitle" class="block text-sm text-ink-muted">{{ l.subtitle }}</span></span>
        <span class="shrink-0 text-right tabular-nums"><span class="block text-sm text-ink-muted">× {{ l.qty }}</span><span class="font-bold">{{ l.price }}</span></span>
      </li>
    </ul>
    <div class="relative p-5 md:pl-8">
      <span class="cstub__edge max-md:hidden" aria-hidden="true" />
      <hr class="mb-4 border-t-2 border-dashed border-brand-sky md:hidden" aria-hidden="true">
      <slot />
    </div>
  </section>
</template>
