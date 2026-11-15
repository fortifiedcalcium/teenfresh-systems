<script setup>
import { rememberDestination } from "~/lib/destination.js";

definePageMeta({ layout: "blank" });
const { signUp, signInWithGoogle } = useAuth();
const route = useRoute();
const from = computed(() => (typeof route.query.from === "string" && route.query.from.startsWith("/") ? route.query.from : "/"));
const form = reactive({ fullName: "", email: "", password: "", confirm: "" });
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const error = ref("");
const done = ref(false);
const busy = ref(false);
const loginTo = computed(() => ({ path: "/login", query: from.value === "/" ? {} : { from: from.value } }));

async function onSubmit() {
  error.value = "";
  const errs = {};
  if (!form.fullName.trim()) errs.fullName = "Enter your full name";
  if (!form.email.trim()) errs.email = "Enter your email address";
  else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address, like name@example.com";
  if (!form.password) errs.password = "Choose a password";
  else if (form.password.length < 8) errs.password = "Use at least 8 characters";
  if (form.confirm !== form.password) errs.confirm = "The passwords do not match. Type the same password again";
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  busy.value = true;
  rememberDestination(from.value);
  const { data, error: err } = await signUp(form.email.trim(), form.password, form.fullName.trim());
  busy.value = false;
  if (err) { error.value = err.message; return; }
  // Supabase answers an already-registered address with a user that has no identities
  if (data.user && data.user.identities?.length === 0) { error.value = "An account with this email already exists. Try signing in instead."; return; }
  done.value = true;
}
</script>

<template>
  <AuthShell v-if="done" :icon="IconMail" title="Check your email">
    <p role="status" class="text-center">We sent a verification link to <strong>{{ form.email }}</strong>. Open it to activate your account, then <NuxtLink :to="loginTo">sign in</NuxtLink>.</p>
  </AuthShell>
  <AuthShell v-else :icon="IconUserPlus" title="Create an account" subtitle="One account lets you register and keep your tickets.">
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <ErrorSummary :errors="errors" :focus-signal="focusSignal" :extra="error" :labels="{ fullName: 'Full name', email: 'Email', password: 'Password', confirm: 'Confirm password' }" />
      <Field id="fullName" v-slot="a" label="Full name" required :error="errors.fullName"><input v-bind="a" v-model="form.fullName" autocomplete="name" class="input"></Field>
      <Field id="email" v-slot="a" label="Email" required :error="errors.email"><input v-bind="a" v-model="form.email" type="email" autocomplete="email" class="input"></Field>
      <div>
        <p id="pw-rules" class="mb-1 text-sm font-semibold">Password rules</p>
        <ul class="mb-2 list-disc pl-5 text-sm text-ink-muted"><li>At least 8 characters</li><li>You can paste from a password manager</li></ul>
        <Field id="password" v-slot="a" label="Password" required :error="errors.password"><PasswordInput v-bind="a" v-model="form.password" autocomplete="new-password" aria-describedby="pw-rules" /></Field>
      </div>
      <Field id="confirm" v-slot="a" label="Confirm password" required :error="errors.confirm"><PasswordInput v-bind="a" v-model="form.confirm" autocomplete="new-password" /></Field>
      <BaseButton type="submit" variant="accent" block :loading="busy"><IconUserPlus />{{ busy ? "Creating account…" : "Sign up" }}</BaseButton>
      <p class="text-center text-sm text-ink-muted">or</p>
      <GoogleButton @click="() => { rememberDestination(from); signInWithGoogle(); }" />
      <p class="text-center text-sm">Already have an account? <NuxtLink :to="loginTo">Sign in</NuxtLink></p>
    </form>
  </AuthShell>
</template>
