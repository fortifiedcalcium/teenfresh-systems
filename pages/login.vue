<script setup>
import { rememberDestination } from "~/lib/destination.js";

definePageMeta({ layout: "blank" });
const { user, loading, signIn, signInWithGoogle, sessionEnded } = useAuth();
const route = useRoute();
const from = computed(() => (typeof route.query.from === "string" && route.query.from.startsWith("/") ? route.query.from : "/"));
const form = reactive({ email: "", password: "" });
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const error = ref("");
const busy = ref(false);

watch(from, (f) => rememberDestination(f), { immediate: true });
watch([loading, user], () => { if (!loading.value && user.value) navigateTo(from.value, { replace: true }); }, { immediate: true });

async function onSubmit() {
  error.value = "";
  const errs = {};
  if (!form.email.trim()) errs.email = "Enter your email address";
  if (!form.password) errs.password = "Enter your password";
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  busy.value = true;
  const { error: err } = await signIn(form.email.trim(), form.password);
  busy.value = false;
  if (err) error.value = /confirm/i.test(err.message) ? "Please confirm your email first. Open the verification link we sent to your inbox, then sign in." : "The email or password is incorrect. Check both and try again, or use “Forgot password?”.";
  else await navigateTo(from.value, { replace: true });
}
</script>

<template>
  <AuthShell :icon="IconLogIn" title="Sign in" subtitle="Sign in to register for events and see your tickets.">
    <Alert v-if="sessionEnded" tone="warn" class="mb-4">Your session ended. Please sign in again to continue.</Alert>
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <ErrorSummary :errors="errors" :focus-signal="focusSignal" :extra="error" :labels="{ email: 'Email', password: 'Password' }" />
      <Field id="email" v-slot="a" label="Email" required :error="errors.email">
        <input v-bind="a" v-model="form.email" type="email" autocomplete="username" class="input">
      </Field>
      <Field id="password" v-slot="a" label="Password" required :error="errors.password">
        <PasswordInput v-bind="a" v-model="form.password" autocomplete="current-password" />
      </Field>
      <button class="btn-primary w-full" :disabled="busy"><IconLogIn />{{ busy ? "Signing in…" : "Sign in" }}</button>
      <p class="text-center text-sm text-ink-muted">or</p>
      <GoogleButton @click="signInWithGoogle()" />
      <p class="text-center text-sm">
        <NuxtLink to="/forgot-password">Forgot password?</NuxtLink> · <NuxtLink :to="{ path: '/register', query: from === '/' ? {} : { from } }">Create an account</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
