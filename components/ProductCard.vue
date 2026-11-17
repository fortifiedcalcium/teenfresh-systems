<script setup lang="ts">
import type { Tone } from "~/types/ui";

// White card, 24px radius, a pastel photo area and a small status badge. `to` is the product page.
withDefaults(defineProps<{ title: string; artist?: string; to: string; priceLabel: string; image?: string | null; imageAlt?: string; badge?: string; badgeTone?: Tone; notice?: string; discount?: number; tint?: number; categories?: string[]; stock?: string | null }>(), { badgeTone: "new", tint: 0 });
const TINTS = ["bg-brand-sky", "bg-brand-blush", "bg-brand-mint", "bg-brand-cream"];
</script>

<template>
  <article class="pcard">
    <div :class="['pcard__photo', TINTS[tint % TINTS.length]]">
      <!-- the title below is the real link; this one only makes the picture clickable, so it stays out of the tab order and the accessibility tree -->
      <NuxtLink :to="to" class="absolute inset-0" aria-hidden="true" tabindex="-1">
        <img v-if="image" :src="image" :alt="imageAlt || ''" loading="lazy" decoding="async" sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" class="h-full w-full object-cover">
        <span v-else class="flex h-full w-full items-center justify-center text-link"><IconImage /></span>
      </NuxtLink>
      <!-- "Pre-order period ended": on the thumbnail itself, in words, not just colour -->
      <span v-if="notice" class="pcard__notice">{{ notice }}</span>
      <span v-if="badge" class="absolute left-3 top-3 rounded-full bg-white p-[3px] shadow-sm"><StatusChip :tone="badgeTone">{{ badge }}</StatusChip></span>
    </div>
    <div class="flex flex-1 flex-col gap-1 p-4">
      <p v-if="artist" class="text-sm text-ink-muted">{{ artist }}</p>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 class="min-w-0 text-base font-black leading-snug"><NuxtLink :to="to" class="text-ink no-underline">{{ title }}</NuxtLink></h2>
        <ul v-if="categories?.length" class="m-0 flex list-none flex-wrap gap-1 p-0" aria-label="Categories">
          <li v-for="c in categories" :key="c" class="rounded-md bg-brand-sky px-2 py-0.5 text-xs font-bold text-ink">{{ c }}</li>
        </ul>
      </div>
      <p class="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2 text-lg font-bold tabular-nums"><span v-if="discount" class="text-danger"><span class="sr-only">Discount </span>{{ discount }}%</span><span>{{ priceLabel }}</span><span v-if="stock" class="ml-auto text-sm font-normal text-ink-muted">{{ stock }}</span></p>
    </div>
  </article>
</template>
