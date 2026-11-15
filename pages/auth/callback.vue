<script setup>
import { takeDestination } from "~/lib/destination.js";

// Landing page for the email-verification link and the Google OAuth redirect.
// The Supabase client exchanges the ?code= for a session by itself; we just wait for it.
definePageMeta({ layout: "blank" });
const { user, loading } = useAuth();
const timedOut = ref(false);
const params = new URLSearchParams(window.location.search + window.location.hash.replace("#", "&"));
const urlError = params.get("error_description");

watch([loading, user], () => { if (!loading.value && user.value) navigateTo(takeDestination() || "/", { replace: true }); }, { immediate: true });
let t;
onMounted(() => { t = setTimeout(() => { timedOut.value = true; }, 12000); });
onBeforeUnmount(() => clearTimeout(t));
</script>

<template>
  <main id="main-content" class="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
    <template v-if="urlError || timedOut">
      <h1 class="flex items-center justify-center gap-2 text-xl"><IconAlert />Sign in did not complete</h1>
      <p role="alert" class="max-w-md text-danger">{{ urlError || "The sign-in took too long. Please try again." }}</p>
      <NuxtLink class="btn-primary" to="/login"><IconLogIn />Back to sign in</NuxtLink>
    </template>
    <Loading v-else label="Signing you in…" logo />
  </main>
</template>
