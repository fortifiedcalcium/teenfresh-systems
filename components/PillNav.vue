<script setup lang="ts">
import logo from "~/assets/logo/teenfresh-logo.png";
import type { NavLink } from "~/types/ui";

// The rounded pill navbar. The logo is a plain link (NuxtLink would mark it current on the home page and paint it dark).
defineProps<{ links: NavLink[] }>();
</script>

<template>
  <nav class="pill-nav" aria-label="Main">
    <a href="/" class="pill-link -ml-1 px-3" aria-label="Teenfresh Events, home" @click.prevent="navigateTo('/')"><img :src="logo" alt="" width="188" height="40" class="h-9 w-auto"></a>
    <div class="flex flex-wrap items-center gap-1">
      <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="pill-link">{{ l.label }}<span v-if="l.badge" class="notif-count" aria-hidden="true">{{ l.badge }}</span><span v-if="l.badge" class="sr-only">, {{ l.badge }} items</span></NuxtLink>
      <slot />
    </div>
  </nav>
</template>
