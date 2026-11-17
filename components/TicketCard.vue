<script setup lang="ts">
import type { Tone } from "~/types/ui";

// An event as a concert ticket: the photo, a pastel header (coral, mint or blue, by `band`) with the title and status, notches and a dashed
// perforation, then the details, a decorative barcode strip and the action. The featured ticket (`priority`) shows its photo whole, so a poster's top text is
// never cut; the other cards crop theirs to the same 16:9 frame, so they are all one size.
const props = withDefaults(defineProps<{ title: string; subtitle?: string; to?: string; image?: string | null; imageAlt?: string; band?: number; statusLabel?: string; statusTone?: Tone; barcode?: string; priority?: boolean; compact?: boolean }>(), { band: 0, statusTone: "ok" });
// Only ink text goes on coral and blue (the contrast check forbids the muted ink there)
const BANDS = ["bg-brand-coral", "bg-brand-mint", "bg-brand-blue"];
const bandClass = computed(() => BANDS[props.band % BANDS.length]);
const titleId = `tc-${useId()}`;
</script>

<template>
  <article class="tcard flex h-full flex-col" :aria-labelledby="titleId">
    <div class="tcard__head overflow-hidden bg-white">
      <slot name="media"><img v-if="image" :src="image" :alt="imageAlt || ''" :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : undefined" decoding="async" width="1600" height="900" :class="priority ? 'h-auto max-h-[36rem] w-full object-contain' : 'aspect-video w-full object-cover'"></slot>
      <div :class="['flex flex-col-reverse items-start gap-2 text-ink', compact ? 'p-4' : 'p-5 pb-6 sm:flex-row sm:justify-between sm:gap-3', bandClass]">
        <div class="min-w-0">
          <h2 :id="titleId" :title="title" :class="['text-lg font-black leading-snug', !compact && 'line-clamp-2']">{{ title }}</h2>
          <p v-if="subtitle && !compact" class="line-clamp-2 text-sm">{{ subtitle }}</p>
        </div>
        <!-- on its own white backing, so the chip stays visible on a pastel of its own colour -->
        <span v-if="statusLabel" class="shrink-0 rounded-full bg-white p-[3px] shadow-sm"><StatusChip :tone="statusTone">{{ statusLabel }}</StatusChip></span>
      </div>
    </div>
    <div class="tcard__perf" aria-hidden="true" />
    <div class="tcard__body flex flex-1 flex-col gap-3 p-5 pt-6">
      <div class="text-sm text-ink"><slot /></div>
      <TicketBarcode v-if="barcode" :value="barcode" class="h-8 w-full opacity-80" />
      <div class="mt-auto"><slot name="action" /></div>
    </div>
  </article>
</template>
