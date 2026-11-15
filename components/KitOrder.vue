<script setup lang="ts">
import type { PropType } from "vue";
import { peso } from "~/lib/payment";

// Choose one kit (radio group) and see the total. One form orders one kit, so there is no quantity.
// The total is announced when the choice changes. The database recalculates the price from the kit itself,
// so nothing here can change what is charged. v-model is the chosen kit id.
defineProps({ kits: { type: Array as PropType<any[]> as PropType<any[]>, required: true }, modelValue: { type: String, default: "" }, error: String, order: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="space-y-5">
    <fieldset :aria-describedby="error ? 'kit-err' : undefined">
      <legend class="label">Kit <span class="font-normal text-ink-muted">(required)</span></legend>
      <div class="space-y-2">
        <label v-for="k in kits" :key="k.id" class="flex min-h-target cursor-pointer items-start gap-3 rounded-lg border border-link bg-white p-3 has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-sky">
          <input type="radio" name="kit_id" :value="k.id" :checked="modelValue === k.id" class="check mt-1" :aria-describedby="`kit-${k.id}`" @change="emit('update:modelValue', k.id)">
          <span :id="`kit-${k.id}`" class="min-w-0 flex-1">
            <span class="flex flex-wrap items-baseline justify-between gap-x-3"><span class="font-bold">{{ k.name }}</span><span class="font-bold">{{ peso(k.unit_price) }}</span></span>
            <span v-if="k.description" class="block text-sm text-ink-muted">{{ k.description }}</span>
          </span>
        </label>
      </div>
      <p v-if="error" id="kit-err" class="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{{ error }}</p>
    </fieldset>

    <p role="status" aria-live="polite" class="rounded-lg border border-link bg-brand-ivory p-3 text-lg font-bold">
      <template v-if="order.kit">Total to pay: {{ peso(order.total) }}</template><template v-else>Choose a kit to see the total.</template>
    </p>
  </div>
</template>
