<script setup lang="ts">
import type { Tone } from "~/types/ui";

// An event as a concert ticket: a coloured header, notches and a dashed perforation, then the details. `band` rotates the header colour per card.
const props = withDefaults(defineProps<{ title: string; subtitle?: string; to?: string; image?: string | null; imageAlt?: string; band?: number; statusLabel?: string; statusTone?: Tone; barcode?: string }>(), { band: 0, statusTone: "ok" });
const BANDS = ["bg-brand-sky", "bg-brand-blush", "bg-brand-mint", "bg-brand-cream"];
const bandClass = computed(() => BANDS[props.band % BANDS.length]);
const titleId = `tc-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <article class="tcard flex h-full flex-col" :aria-labelledby="titleId">
    <div :class="['tcard__head', bandClass, 'overflow-hidden']">
      <img v-if="image" :src="image" :alt="imageAlt || ''" loading="lazy" decoding="async" class="aspect-video w-full object-cover">
      <div class="flex items-start justify-between gap-3 p-5 pb-6">
        <div class="min-w-0">
          <h2 :id="titleId" :title="title" class="line-clamp-2 text-lg font-black leading-snug">{{ title }}</h2>
          <p v-if="subtitle" class="line-clamp-2 text-sm text-ink-muted">{{ subtitle }}</p>
        </div>
        <StatusChip v-if="statusLabel" :tone="statusTone">{{ statusLabel }}</StatusChip>
      </div>
    </div>
    <div class="tcard__perf" aria-hidden="true" />
    <div class="tcard__body flex flex-1 flex-col gap-3 p-5 pt-6">
      <div class="text-sm text-ink-muted"><slot /></div>
      <TicketBarcode v-if="barcode" :value="barcode" />
      <div class="mt-auto"><slot name="action" /></div>
    </div>
  </article>
</template>
