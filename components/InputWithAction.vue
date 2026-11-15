<script setup lang="ts">
// A labelled text box with a button beside it (for example "Shipping fee" and "Send shipping fee"), with the hint under both.
// The button (the `action` slot) lines up with the text box itself, not with the hint below it.
defineOptions({ inheritAttrs: false });
defineProps({ id: String, label: String, hint: String, modelValue: { type: [String, Number], default: "" }, inputClass: { type: String, default: "input" } });
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div>
    <label :for="id" class="label">{{ label }}</label>
    <div class="flex flex-wrap items-center gap-2">
      <input :id="id" :class="inputClass" :aria-describedby="hint ? `${id}-hint` : undefined" v-bind="$attrs" :value="modelValue" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)">
      <slot name="action" />
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="hint">{{ hint }}</p>
  </div>
</template>
