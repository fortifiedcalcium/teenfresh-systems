<script setup lang="ts">
import type { PropType } from "vue";
import logo from "~/assets/logo/teenfresh-logo.png";

// `decor` (from useAuthDecor) is the nearest event's poster: when it is ready, the card grows a second, decorative column on wide screens.
// It stays a single centred card on phones and whenever there is nothing to decorate it with.
defineProps({ title: String, subtitle: String, icon: Object as PropType<Record<string, any>>, decor: Object as PropType<{ title: string; poster: string } | null> });
</script>

<template>
  <SkipLink />
  <div class="flex min-h-screen items-center justify-center bg-brand-blush px-4 py-10">
    <main id="main-content" tabindex="-1" :class="['card-soft w-full p-6 sm:p-8', decor ? 'max-w-4xl lg:grid lg:grid-cols-2 lg:gap-0 lg:p-0' : 'max-w-md']">
      <div v-if="decor" class="relative hidden overflow-hidden rounded-l-[1.5rem] bg-brand-cream lg:block" aria-hidden="true">
        <div class="photocard absolute left-1/2 top-1/2 w-56" style="--tilt: -4deg; translate: -50% -58%">
          <img :src="decor.poster" alt="" class="photocard__img">
        </div>
        <p class="absolute inset-x-8 bottom-8 text-3xl font-black leading-tight" style="text-wrap: balance">Your tickets, all in one place.</p>
      </div>
      <div :class="decor ? 'lg:p-10' : ''">
        <NuxtLink to="/" class="mb-4 flex min-h-target items-center justify-center" aria-label="Teenfresh Events, home"><img :src="logo" alt="" width="235" height="50" class="h-[50px] w-auto"></NuxtLink>
        <h1 class="flex items-center justify-center gap-2 text-center text-xl font-black"><component :is="icon" v-if="icon" />{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-center text-sm text-ink-muted">{{ subtitle }}</p>
        <div class="mt-5"><slot /></div>
      </div>
    </main>
  </div>
</template>
