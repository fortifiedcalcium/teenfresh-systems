<script setup lang="ts">
import type { Tone } from "~/types/ui";

// White card, 24px radius, a pastel photo area and a small status badge. `to` is the product page.
withDefaults(defineProps<{ title: string; artist?: string; to: string; priceLabel: string; image?: string | null; imageAlt?: string; badge?: string; badgeTone?: Tone; discount?: number; tint?: number }>(), { badgeTone: "new", tint: 0 });
const TINTS = ["bg-brand-sky", "bg-brand-blush", "bg-brand-mint", "bg-brand-cream"];
</script>

<template>
  <article class="pcard">
    <NuxtLink :to="to" :class="['pcard__photo', TINTS[tint % TINTS.length]]" :aria-label="`View ${title}`" tabindex="-1">
      <img v-if="image" :src="image" :alt="imageAlt || ''" loading="lazy" decoding="async" sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" class="h-full w-full object-cover">
      <span v-else class="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></span>
      <span v-if="badge" class="absolute left-3 top-3"><StatusChip :tone="badgeTone">{{ badge }}</StatusChip></span>
    </NuxtLink>
    <div class="flex flex-1 flex-col gap-1 p-4">
      <p v-if="artist" class="text-sm text-ink-muted">{{ artist }}</p>
      <h2 class="min-w-0 text-base font-black leading-snug"><NuxtLink :to="to" class="text-ink no-underline">{{ title }}</NuxtLink></h2>
      <p class="mt-auto flex items-baseline gap-2 pt-2 text-lg font-bold tabular-nums"><span v-if="discount" class="text-danger"><span class="sr-only">Discount </span>{{ discount }}%</span><span>{{ priceLabel }}</span></p>
    </div>
  </article>
</template>
