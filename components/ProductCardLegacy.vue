<script setup>
import { productImageUrl } from "~/lib/products.js";
import { peso } from "~/lib/payment.js";
import { allSoldOut } from "~/lib/variations.js";

const props = defineProps({ p: { type: Object, required: true }, options: { type: Array, default: () => [] } });
// a product whose versions cost different amounts shows "From" its lowest price
const from = computed(() => {
  const prices = props.options.map((v) => (v.price != null ? Number(v.price) : Number(props.p.price)));
  return prices.length > 0 && Math.min(...prices) !== Math.max(...prices) ? Math.min(...prices) : null;
});
const src = computed(() => productImageUrl(props.p));
</script>

<template>
  <li>
    <article class="shop-card">
      <NuxtLink :to="`/shop/${p.id}`" class="block" :aria-label="`View ${p.title}`" tabindex="-1">
        <div class="shop-thumb">
          <img v-if="src" :src="src" :alt="p.image_alt || ''" loading="lazy" class="shop-art h-full w-full object-cover">
          <div v-else class="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
        </div>
      </NuxtLink>
      <div class="flex flex-1 flex-col gap-1 px-1 pb-2 pt-3">
        <p v-if="allSoldOut(options)" class="text-sm font-black text-danger">Sold out</p>
        <p v-if="p.pre_order" class="shop-pre">Pre-order</p>
        <p class="text-sm text-ink-muted">{{ p.artist }}</p>
        <div class="flex items-start gap-2">
          <h2 class="shop-title min-w-0 flex-1"><NuxtLink :to="`/shop/${p.id}`" class="shop-card-link no-underline text-ink">{{ p.title }}</NuxtLink></h2>
          <span v-if="p.is_new" class="shop-new">NEW</span>
        </div>
        <p class="mt-auto flex items-baseline gap-2 pt-1 text-lg font-bold tabular-nums">
          <span v-if="p.discount_percent > 0" class="text-danger"><span class="sr-only">Discount </span>{{ p.discount_percent }}%</span>
          <span class="text-ink"><span v-if="from != null" class="text-sm font-semibold">From </span>{{ peso(from ?? p.price) }}</span>
        </p>
      </div>
    </article>
  </li>
</template>
