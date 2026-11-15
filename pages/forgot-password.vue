<script setup>
definePageMeta({ layout: "blank" });
const { resetPassword } = useAuth();
const email = ref("");
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const sent = ref(false);
const error = ref("");
const busy = ref(false);

async function onSubmit() {
  error.value = "";
  errors.value = email.value.trim() ? {} : { email: "Enter your email address" };
  if (errors.value.email) { bumpFocus(); return; }
  busy.value = true;
  const { error: err } = await resetPassword(email.value.trim());
  busy.value = false;
  if (err) error.value = err.message;
  else sent.value = true; // same message whether or not the account exists
}
</script>

<template>
  <AuthShell :icon="IconMail" title="Forgot your password?" subtitle="Enter your email and we will send you a reset link.">
    <p v-if="sent" role="status" class="text-center">If an account exists for that address, a reset link is on its way. <NuxtLink to="/login">Back to sign in</NuxtLink></p>
    <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
      <ErrorSummary :errors="errors" :focus-signal="focusSignal" :extra="error" :labels="{ email: 'Email' }" />
      <Field id="email" v-slot="a" label="Email" required :error="errors.email"><input v-bind="a" v-model="email" type="email" autocomplete="email" class="input"></Field>
      <button class="btn-primary w-full" :disabled="busy"><IconSend />{{ busy ? "Sending…" : "Send reset link" }}</button>
      <p class="text-center text-sm"><NuxtLink to="/login">Back to sign in</NuxtLink></p>
    </form>
  </AuthShell>
</template>
