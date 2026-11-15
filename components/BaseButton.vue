<script setup lang="ts">
import type { ButtonVariant } from "~/types/ui";

// A fully rounded button. With `to` it is a link, otherwise a <button>. `loading` disables it and shows the label as "busy".
const props = withDefaults(defineProps<{ variant?: ButtonVariant; small?: boolean; block?: boolean; to?: string; disabled?: boolean; loading?: boolean; type?: "button" | "submit" }>(), { variant: "primary", type: "button" });
const classes = computed(() => ["bbtn", `bbtn--${props.variant}`, props.small && "bbtn--sm", props.block && "bbtn--block"]);
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes"><slot /></NuxtLink>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined"><slot /></button>
</template>
