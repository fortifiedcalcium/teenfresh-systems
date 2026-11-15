<script setup>
definePageMeta({ layout: "blank" });
const { session, loading, updatePassword } = useAuth();
const form = reactive({ password: "", confirm: "" });
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const error = ref("");
const busy = ref(false);

async function onSubmit() {
  error.value = "";
  const errs = {};
  if (!form.password) errs.password = "Choose a password";
  else if (form.password.length < 8) errs.password = "Use at least 8 characters";
  if (form.confirm !== form.password) errs.confirm = "The passwords do not match. Type the same password again";
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  busy.value = true;
  const { error: err } = await updatePassword(form.password);
  busy.value = false;
  if (err) error.value = err.message;
  else await navigateTo("/", { replace: true });
}
</script>

<template>
  <!-- The reset link signs the user in (recovery session); without one there is nothing to reset. -->
  <AuthShell v-if="loading" :icon="IconKey" title="Reset password"><Loading /></AuthShell>
  <AuthShell v-else-if="!session" :icon="IconAlert" title="Link expired"><p class="text-center">This reset link is invalid or has expired. <NuxtLink to="/forgot-password">Request a new one</NuxtLink>.</p></AuthShell>
  <AuthShell v-else :icon="IconKey" title="Choose a new password">
    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <ErrorSummary :errors="errors" :focus-signal="focusSignal" :extra="error" :labels="{ password: 'New password', confirm: 'Confirm new password' }" />
      <div>
        <p id="pw-rules" class="mb-1 text-sm font-semibold">Password rules</p>
        <ul class="mb-2 list-disc pl-5 text-sm text-ink-muted"><li>At least 8 characters</li></ul>
        <Field id="password" v-slot="a" label="New password" required :error="errors.password"><PasswordInput v-bind="a" v-model="form.password" autocomplete="new-password" aria-describedby="pw-rules" /></Field>
      </div>
      <Field id="confirm" v-slot="a" label="Confirm new password" required :error="errors.confirm"><PasswordInput v-bind="a" v-model="form.confirm" autocomplete="new-password" /></Field>
      <button class="btn-primary w-full" :disabled="busy"><IconKey />{{ busy ? "Saving…" : "Update password" }}</button>
    </form>
  </AuthShell>
</template>
