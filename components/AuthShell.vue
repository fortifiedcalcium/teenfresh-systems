<script setup lang="ts">
import type { PropType } from "vue";
import logo from "~/assets/logo/teenfresh-logo.png";

defineProps({ title: String, subtitle: String, icon: Object as PropType<Record<string, any>> });
</script>

<template>
  <SkipLink />
  <div class="flex min-h-screen items-center justify-center bg-brand-blush px-4 py-10">
    <main id="main-content" tabindex="-1" class="card-soft w-full max-w-md p-6 sm:p-8">
      <NuxtLink to="/" class="mb-4 flex min-h-target items-center justify-center" aria-label="Teenfresh Events, home"><img :src="logo" alt="" width="235" height="50" class="h-[50px] w-auto"></NuxtLink>
      <h1 class="flex items-center justify-center gap-2 text-center text-xl font-black"><component :is="icon" v-if="icon" />{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-center text-sm text-ink-muted">{{ subtitle }}</p>
      <div class="mt-5"><slot /></div>
    </main>
  </div>
</template>
