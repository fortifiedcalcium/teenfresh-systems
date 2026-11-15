<script setup lang="ts">
import type { PropType } from "vue";
import { peso } from "~/lib/payment";

// What you pay, in pesos. Shared by the cart and the checkout summary.
defineProps({ totals: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true }, shippingNote: { type: Boolean, default: true } });
</script>

<template>
  <dl class="space-y-1 text-sm">
    <div class="flex justify-between gap-4"><dt>Items</dt><dd class="tabular-nums">{{ peso(totals.subtotalPhp) }}</dd></div>
    <div class="flex justify-between gap-4"><dt>Shipping</dt><dd class="text-right">{{ shippingNote ? "Set after confirmation" : "Paid separately" }}</dd></div>
    <div class="flex justify-between gap-4 border-t border-brand-sky pt-2 text-base font-black"><dt>Total to pay now (GCash)</dt><dd class="tabular-nums">{{ peso(totals.totalPhp) }}</dd></div>
  </dl>
</template>
