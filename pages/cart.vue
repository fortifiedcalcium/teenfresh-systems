<script setup>
import { MAX_QTY, priceOrder } from "~/lib/orders.js";
import { peso } from "~/lib/payment.js";
import { variationLabel } from "~/lib/variations.js";

definePageMeta({ middleware: ["shop"] });
const { items, setQty, remove } = useCart();
const state = useCartProducts();
const settings = useShopSettings();
const cartLines = useCartLines(computed(() => state.value.products), computed(() => state.value.variations));
const lines = computed(() => cartLines.value.lines);
const gone = computed(() => cartLines.value.gone);
const announce = useAnnounce();
// Fewer left than in the cart: lower the quantity to what is left, and say so. Sold out lines stay, marked, until the shopper removes them.
watch(lines, (ls) => {
  const over = ls.filter((l) => l.stock != null && l.stock > 0 && l.quantity > l.stock);
  over.forEach((l) => setQty(l.key, l.stock));
  if (over.length) announce(`Only ${over.map((l) => `${l.stock} of ${l.title} left`).join(", ")}. We lowered the quantity.`);
}, { immediate: true });
const soldOut = computed(() => lines.value.filter((l) => l.stock === 0));
watch(gone, (g) => { g.forEach(remove); if (g.length) announce("A product in your cart is no longer available and was removed."); }, { immediate: true });
const totals = computed(() => priceOrder(lines.value));
const qtyOptions = (l) => Array.from({ length: Math.max(1, Math.min(MAX_QTY, l.stock ?? MAX_QTY)) }, (_, i) => i + 1);
const nameOf = (l) => `${l.title}${l.variation ? `, ${l.variation.name}` : ""}`;
</script>

<template>
  <div class="space-y-4">
    <h1 class="flex items-center gap-2 text-3xl"><IconCart />Your cart</h1>
    <Alert v-if="state.error" tone="bad">{{ state.error }}</Alert>
    <Alert v-if="gone.length > 0" tone="warn">A product in your cart is no longer available, so it was removed.</Alert>
    <Alert v-if="soldOut.length > 0" tone="warn">{{ soldOut.length === 1 ? "An item in your cart is sold out." : "Some items in your cart are sold out." }} Remove {{ soldOut.length === 1 ? "it" : "them" }} to go to checkout.</Alert>
    <Alert v-if="lines.some((l) => l.stock != null && l.stock > 0 && l.quantity >= l.stock)" tone="info">Some items have only a few left. The quantity can be no more than what is left.</Alert>
    <Loading v-if="state.products === null || (items.length > 0 && !settings)" label="Loading your cart…" class="p-12" />
    <Empty v-else-if="lines.length === 0">Your cart is empty. <NuxtLink to="/shop">Browse the shop</NuxtLink></Empty>
    <CartStub v-else>
      <template #lines>
        <ul class="divide-y divide-brand-sky">
          <li v-for="l in lines" :key="l.key" class="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <LineThumb :p="l" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-ink-muted">{{ l.artist }}</p>
              <h2 class="break-words text-base font-bold">{{ l.title }}</h2>
              <p v-if="l.stock === 0" class="text-sm font-bold text-danger">Sold out</p>
              <p v-if="l.stock != null && l.stock > 0 && l.stock <= 5" class="text-sm font-semibold text-ink-muted">Only {{ l.stock }} left</p>
              <p v-if="l.variation" class="text-sm font-semibold">{{ l.variation.options ? variationLabel(l.variation) : `Version: ${l.variation.name}` }}</p>
              <p class="tabular-nums font-bold">{{ peso(l.price) }}<span v-if="l.discount_percent > 0" class="ml-2 text-danger"><span class="sr-only">Discount </span>{{ l.discount_percent }}%</span></p>
            </div>
            <div class="flex items-center gap-2">
              <label :for="`qty-${l.key}`" class="sr-only">Quantity of {{ nameOf(l) }}</label>
              <select :id="`qty-${l.key}`" class="input w-20 !rounded-full" :value="l.quantity" @change="setQty(l.key, Number($event.target.value))">
                <option v-for="n in qtyOptions(l)" :key="n" :value="n">{{ n }}</option>
              </select>
              <BaseButton variant="secondary" small @click="() => { remove(l.key); announce(`${l.title}${l.variation ? `, ${l.variation.name},` : ''} removed from your cart`); }"><IconTrash />Remove <span class="sr-only">{{ nameOf(l) }}</span></BaseButton>
            </div>
          </li>
        </ul>
      </template>
      <h2 class="mb-3 text-lg font-black">Summary</h2>
      <OrderTotals :totals="totals" />
      <div class="mt-4 space-y-2">
        <BaseButton v-if="soldOut.length > 0" variant="accent" block disabled>Go to checkout</BaseButton>
        <BaseButton v-else to="/checkout" variant="accent" block>Go to checkout</BaseButton>
        <BaseButton to="/shop" variant="secondary" block>Keep shopping</BaseButton>
      </div>
    </CartStub>
  </div>
</template>
