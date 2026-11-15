<script setup>
// 3.3.8: paste and password managers work (nothing is blocked); a show/hide toggle helps people who cannot easily retype.
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: { type: String, default: "" } });
const emit = defineEmits(["update:modelValue"]);
const show = ref(false);
</script>

<template>
  <div class="flex gap-2">
    <input v-bind="$attrs" :value="modelValue" :type="show ? 'text' : 'password'" class="input" @input="emit('update:modelValue', $event.target.value)">
    <button type="button" class="bbtn bbtn--secondary bbtn--sm shrink-0" :aria-pressed="show" @click="show = !show"><IconEyeOff v-if="show" /><IconEye v-else />{{ show ? "Hide" : "Show" }} <span class="sr-only">password</span></button>
  </div>
</template>
