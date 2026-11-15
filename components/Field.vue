<script setup>
// Visible label, "(required)" text, hint and error wired together for screen readers (3.3.2, 1.3.1, 3.3.1).
// The default slot receives the attributes the control needs: <Field v-slot="a"><input v-bind="a" /></Field>
const props = defineProps({ label: String, error: String, hint: String, id: { type: String, required: true }, required: Boolean });
const attrs = computed(() => ({
  id: props.id,
  "aria-invalid": props.error ? "true" : undefined,
  "aria-describedby": [props.error ? `${props.id}-err` : null, props.hint ? `${props.id}-hint` : null].filter(Boolean).join(" ") || undefined,
  "aria-required": props.required ? "true" : undefined,
}));
</script>

<template>
  <div :class="error ? 'field-error' : undefined">
    <label :for="id" class="label">{{ label }}<span v-if="required" class="font-normal text-ink-muted"> (required)</span></label>
    <slot v-bind="attrs" />
    <p v-if="hint" :id="`${id}-hint`" class="hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-err`" class="field-msg"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ error }}</p>
  </div>
</template>
