<script setup>
import { isConfigured } from "~/lib/supabaseClient.js";
import { titleFor } from "~/lib/titles.js";

// A unique title for every route (2.4.2). A page that names itself (an event, a product) overrides it through useSeo.
const route = useRoute();
useHead(() => ({ title: `${titleFor(route.path)} · Teenfresh Events` }));
</script>

<template>
  <div>
    <main v-if="!isConfigured" id="main-content" class="mx-auto max-w-xl p-8">
      <h1 class="mb-2 flex items-center gap-2 text-xl font-black"><IconAlert />Supabase is not configured</h1>
      <p class="text-ink-muted">Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</p>
    </main>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
    <ToastHost />
    <LiveRegions />
  </div>
</template>
