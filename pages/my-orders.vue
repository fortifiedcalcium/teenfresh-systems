<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";

definePageMeta({ middleware: ["shop", "auth"] });
const { user } = useAuth();
const orders = ref(null);
const error = ref("");

async function load() {
  // "My" orders: ask for my own rows explicitly. The database lets admins read every order (they need that in Admin), so
  // without this filter an admin saw every customer's orders on this page.
  const { data, error: err } = await supabase.from("orders").select("*").eq("user_id", user.value.id).order("created_at", { ascending: false });
  if (err) { error.value = "We could not load your orders. Check your connection and refresh the page."; orders.value ??= []; return; }
  error.value = ""; orders.value = data || [];
}
onMounted(load);
useLiveReload("orders", load, { filter: `user_id=eq.${user.value?.id}` });          // a payment confirmed, a shipment: it shows up by itself
</script>

<template>
  <div class="space-y-4">
    <h1 class="flex items-center gap-2 text-3xl"><IconPackage />My orders</h1>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <Loading v-if="orders === null" label="Loading your orders…" class="p-12" />
    <Empty v-else-if="orders.length === 0">You have not placed an order yet. <NuxtLink to="/shop">Browse the shop</NuxtLink></Empty>
    <ul v-else class="space-y-3">
      <li v-for="o in orders" :key="o.id" class="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 class="font-black">Order {{ o.order_number }}</h2>
          <p class="text-sm text-ink-muted">{{ fmtDateTime(o.created_at) }} · {{ peso(o.total_php) }}</p>
        </div>
        <div class="flex items-center gap-3"><OrderStatusBadge :order="o" /><NuxtLink :to="`/orders/${o.id}`" class="btn-secondary no-underline"><IconEye />View order <span class="sr-only">{{ o.order_number }}</span></NuxtLink></div>
      </li>
    </ul>
  </div>
</template>
