<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { SHIPPING } from "~/lib/orders";
import { nextText } from "~/lib/orderNext";
import { peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";

// One order: used right after checkout (with a thank-you banner) and from My orders. Only the owner and admins can open it (RLS).
definePageMeta({ middleware: ["shop", "auth"] });
const { user } = useAuth();
const route = useRoute();
const placed = computed(() => route.query.placed === "1");
const order = ref(undefined);       // undefined loading, null not found
const items = ref([]);

async function load() {
  const id = route.params.id;
  // Only MY order: admins can read every order in the database, so ask for mine explicitly. Someone else's order reads as "not found".
  const o = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user.value.id).maybeSingle();
  const it: any = o.data ? await supabase.from("order_items").select("*").eq("order_id", id).order("title") : { data: [] };
  if (id !== route.params.id) return;
  // a background refresh that fails keeps what is on screen; only the first load may say "not found"
  order.value = o.error && order.value ? order.value : o.data || null;
  if (!it.error) items.value = it.data || [];
}
watch(() => route.params.id, () => { order.value = undefined; load(); }, { immediate: true });
useLiveReload("orders", load, { filter: `user_id=eq.${user.value?.id}` });       // the status, the shipping fee, the tracking number: no browser refresh needed

const hasFee = computed(() => order.value?.shipping_fee_php != null);
const shippingStage = computed(() => order.value?.status === "paid" && (order.value.shipping_status === "awaiting_payment" || order.value.shipping_status === "pending_review"));   // the shipping fee is the only thing left to pay
const open = computed(() => order.value?.status === "pending" || order.value?.status === "paid");
const balanceOpen = computed(() => order.value?.balance_status && order.value.balance_status !== "none" && order.value.balance_due_php != null);
</script>

<template>
  <Loading v-if="order === undefined" label="Loading your order…" class="p-12" />
  <Alert v-else-if="order === null" tone="bad">We could not find that order. <NuxtLink to="/my-orders">Go to My orders</NuxtLink></Alert>
  <div v-else class="space-y-4">
    <Alert v-if="placed" tone="ok"><span><strong>Thank you! Your order was placed.</strong> Keep your order number: {{ order.order_number }}.</span></Alert>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="flex items-center gap-2 text-3xl"><IconPackage />Order {{ order.order_number }}</h1>
      <OrderStatusBadge :order="order" />
    </div>
    <p class="text-ink-muted">Placed {{ fmtDateTime(order.created_at) }}. {{ nextText(order) }}</p>
    <div class="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section class="card p-4" aria-labelledby="items-h">
        <h2 id="items-h" class="mb-2 text-lg font-black">Items</h2>
        <ul class="divide-y divide-brand-sky">
          <li v-for="i in items" :key="i.id" class="flex flex-wrap items-baseline justify-between gap-2 py-2"><span class="min-w-0"><span class="block text-sm text-ink-muted">{{ i.artist }}</span><span class="break-words font-bold">{{ i.title }}</span><span v-if="i.variation_name" class="block text-sm font-semibold">Version: {{ i.variation_name }}</span></span><span class="tabular-nums">{{ shippingStage ? `× ${i.quantity}` : `${peso(i.unit_price_php)} × ${i.quantity}` }}</span></li>
        </ul>
        <!-- Paying the shipping fee: show only that fee. The order itself is already paid, so its amount is left out. -->
        <dl v-if="shippingStage" class="mt-3 space-y-1 border-t border-brand-sky pt-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black">
            <dt>{{ order.shipping_status === "awaiting_payment" ? "Shipping fee to pay" : "Shipping fee" }}</dt>
            <dd class="ml-auto flex flex-wrap items-center justify-end gap-2 text-right"><span class="tabular-nums">{{ peso(order.shipping_fee_php) }}</span><Badge tone="warn">{{ order.balance_status === "awaiting_payment" && order.balance_for === "shipping" ? "Payment is short" : order.shipping_status === "awaiting_payment" ? "Awaiting payment" : SHIPPING.pending_review.label }}</Badge></dd>
          </div>
          <div v-if="balanceOpen" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black"><dt>{{ order.balance_status === "awaiting_payment" ? "Still to pay (underpaid)" : "Extra payment being checked" }}</dt><dd class="tabular-nums">{{ peso(order.balance_due_php) }}</dd></div>
        </dl>
        <dl v-else class="mt-3 space-y-1 border-t border-brand-sky pt-3 text-sm">
          <div class="flex justify-between"><dt>Items</dt><dd class="tabular-nums">{{ peso(order.subtotal_php) }}</dd></div>
          <div v-if="hasFee" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><dt>Shipping fee (paid separately)</dt><dd class="ml-auto text-right"><span class="tabular-nums">{{ Number(order.shipping_fee_php) > 0 ? peso(order.shipping_fee_php) : "Free" }}</span> <Badge :tone="SHIPPING[order.shipping_status].tone">{{ SHIPPING[order.shipping_status].label }}</Badge></dd></div>
          <div v-else-if="order.shipping_status === 'none'" class="flex justify-between gap-4"><dt>Shipping fee</dt><dd class="text-right">Set after your payment is confirmed</dd></div>
          <div v-else class="flex justify-between"><dt>Shipping</dt><dd class="tabular-nums">{{ Number(order.shipping_php) > 0 ? peso(order.shipping_php) : "Free" }}</dd></div>
          <div class="flex justify-between text-base font-black"><dt>{{ order.status === "pending" ? "Total to pay (GCash)" : "Total paid (GCash)" }}</dt><dd class="tabular-nums">{{ peso(order.total_php) }}</dd></div>
          <div v-if="balanceOpen" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-black"><dt>{{ order.balance_status === "awaiting_payment" ? "Still to pay (underpaid)" : "Extra payment being checked" }}</dt><dd class="tabular-nums">{{ peso(order.balance_due_php) }}</dd></div>
        </dl>
      </section>
      <section class="card space-y-3 p-4 text-sm" aria-labelledby="ship-h">
        <h2 id="ship-h" class="text-lg font-black">Delivery</h2>
        <p><strong>{{ order.name }}</strong><br>{{ order.address }}<br>{{ order.city }} {{ order.postal_code }}<br>{{ order.phone }}<br>{{ order.email }}</p>
        <p v-if="order.notes"><span class="font-semibold">Your note:</span> {{ order.notes }}</p>
        <CourierChoice v-if="open && order.shipping_status === 'none'" :key="order.preferred_courier || 'none'" :order="order" @saved="load" />
        <p v-if="!(open && order.shipping_status === 'none') && order.preferred_courier"><span class="font-semibold">Courier:</span> {{ order.preferred_courier }}
          <span v-if="open" class="block text-ink-muted">It can no longer be changed because your shipping fee is set.</span></p>
        <div v-if="order.status === 'shipped' && order.courier" class="rounded-lg bg-brand-sky p-3">
          <p><span class="font-semibold">Courier:</span> {{ order.courier }}</p>
          <p v-if="order.tracking_number" class="flex flex-wrap items-center gap-2"><span class="font-semibold">Tracking number:</span> <span class="font-mono font-bold">{{ order.tracking_number }}</span><CopyButton :text="order.tracking_number" label="Copy tracking number" what="tracking number" /></p>
          <p v-else class="text-ink-muted">This courier did not give a tracking number.</p>
        </div>
        <p class="flex items-center gap-1 text-ink-muted"><IconCheck />GCash reference {{ order.reference_number }}</p>
      </section>
    </div>
    <BalancePayment v-if="open && order.balance_status === 'awaiting_payment'" :order="order" @sent="load" />
    <ShippingPayment v-if="order.status === 'paid' && order.shipping_status === 'awaiting_payment' && order.balance_status !== 'awaiting_payment'" :order="order" @sent="load" />
    <p class="flex flex-col gap-2 sm:flex-row"><NuxtLink to="/shop" class="btn-secondary no-underline"><IconArrowLeft />Back to the shop</NuxtLink><NuxtLink to="/my-orders" class="btn-secondary no-underline"><IconPackage />All my orders</NuxtLink></p>
  </div>
</template>
