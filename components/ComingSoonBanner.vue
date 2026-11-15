<script setup lang="ts">
import logoImg from "~/assets/logo/teenfresh-logo.png";
import { SLOTS } from "~/lib/eventImages";

// The "Coming soon" panel that stands in for a banner (events.banner_coming_soon). Same aspect ratio as the banner,
// so the cards stay equal. The words are real text; the logo is decoration.
defineProps({ ratio: { type: String, default: SLOTS.banner.ratio } });
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 bg-brand-sky p-4 text-center text-ink" :style="{ aspectRatio: ratio }" data-coming-soon="true">
    <img :src="logoImg" alt="" class="h-12 w-auto max-w-[70%] object-contain">
    <p class="text-2xl font-bold uppercase tracking-widest">Coming soon</p>
  </div>
</template>
