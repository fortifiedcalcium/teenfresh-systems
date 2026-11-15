<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { SHIPPING, displayStatus } from "~/lib/orders.js";
import { peso } from "~/lib/payment.js";
import { fmtDateTime } from "~/lib/availability.js";
import { exportReportSheets } from "~/lib/excel.js";
import { orderReport, orderReportFilename } from "~/lib/orderReport.js";
import { fetchAll } from "~/lib/api.js";

const FILTERS = [["all", "All"], ["pending", "Awaiting payment"], ["set_fee", "Set shipping fee"], ["underpaid", "Underpaid"], ["ship_review", "Shipping payment to check"], ["paid", "Paid"], ["shipped", "Shipped"], ["cancelled", "Cancelled"]];
const toast = useToast();
const orders = ref(null);
const filter = ref("all");
const openId = ref(null);
const deleting = ref(null);           // the order waiting for "Yes, delete"
const deleteBusy = ref(false);
const exporting = ref(false);

async function load(quiet = false) {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { if (!quiet) toast("Could not load the orders: " + error.message, "error"); if (quiet) return; }       // a background refresh that fails keeps what is on screen
  orders.value = data || [];
}
onMounted(() => load());
useLiveReload("orders", () => load(true));                                  // new orders and changes show up by themselves, no browser refresh
const open = computed(() => (orders.value || []).find((o) => o.id === openId.value) || null);           // the open order is always the freshest copy

// Deleting removes the order, its items and its email log, then its receipt files. The Change log keeps who did it.
async function removeOrder() {
  const o = deleting.value;
  deleteBusy.value = true;
  const { data, error } = await supabase.from("orders").delete().eq("id", o.id).select("id");
  if (error || !data?.length) { deleteBusy.value = false; toast(error ? error.message : "The order was not deleted. Check that you are signed in as an admin.", "error"); return; }   // nothing was removed: keep the files
  const paths = [o.receipt_path, o.shipping_receipt_path, o.balance_receipt_path].filter(Boolean);
  if (paths.length) await supabase.storage.from("payment-receipts").remove(paths);
  orders.value = (orders.value || []).filter((x) => x.id !== o.id);
  if (openId.value === o.id) openId.value = null;
  deleting.value = null; deleteBusy.value = false;
  toast(`Order ${o.order_number} deleted`, "success");
}
// The whole rundown, not just what is on screen: every order and every product line, straight from the database.
async function exportAll() {
  exporting.value = true;
  try {
    const [all, lines] = await Promise.all([fetchAll(() => supabase.from("orders").select("*").order("created_at", { ascending: false }).order("id")), fetchAll(() => supabase.from("order_items").select("*").order("id"))]);
    await exportReportSheets(toast, orderReportFilename(), orderReport(all, lines));
  } catch { toast("Could not collect the orders for the Excel file. Please try again.", "error"); }
  exporting.value = false;
}
const matches = {
  set_fee: (o) => o.status === "paid" && o.shipping_status === "none",
  ship_review: (o) => o.shipping_status === "pending_review",
  underpaid: (o) => Boolean(o.balance_status) && o.balance_status !== "none",
};
const shown = computed(() => (orders.value || []).filter((o) => filter.value === "all" || (matches[filter.value] ? matches[filter.value](o) : displayStatus(o) === filter.value)));
const changed = () => { openId.value = null; load(); };
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="flex items-center gap-2 text-2xl"><IconBag />Shop orders</h1>
      <TopBarAction :icon="IconDownload" :label="exporting ? 'Preparing…' : 'Export all orders to Excel'" short="Export" :disabled="exporting || !orders?.length" @click="exportAll" />
    </div>
    <ShopSettingsCard />
    <CourierManager />
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter orders">
      <button v-for="[k, l] in FILTERS" :key="k" type="button" class="shop-chip" :aria-pressed="filter === k" @click="filter = k">{{ l }}</button>
    </div>
    <Loading v-if="orders === null" label="Loading orders…" />
    <Empty v-else-if="shown.length === 0">No orders here yet.</Empty>
    <ul v-else class="space-y-3">
      <li v-for="o in shown" :key="o.id" class="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div><h2 class="font-black">{{ o.order_number }} · {{ o.name }}</h2><p class="text-sm text-ink-muted">{{ fmtDateTime(o.created_at) }} · {{ peso(o.total_php) }} · ref {{ o.reference_number }}{{ o.preferred_courier ? ` · wants ${o.preferred_courier}` : "" }}</p></div>
        <div class="flex flex-wrap items-center gap-3"><OrderStatusBadge :order="o" /><Badge v-if="o.status === 'paid' && o.shipping_status && o.shipping_status !== 'paid'" :tone="SHIPPING[o.shipping_status].tone">{{ SHIPPING[o.shipping_status].label }}</Badge><button type="button" class="btn-danger" @click="deleting = o"><IconTrash />Delete <span class="sr-only">order {{ o.order_number }}</span></button><button type="button" class="btn-secondary" @click="openId = o.id">Review <span class="sr-only">order {{ o.order_number }}</span></button></div>
      </li>
    </ul>
    <ConfirmDialog v-if="deleting" :title="`Delete order ${deleting.order_number}?`" confirm-label="Yes, delete this order" :busy="deleteBusy" @cancel="deleting = null" @confirm="removeOrder">
      <p>This deletes order <strong>{{ deleting.order_number }}</strong> for <strong>{{ deleting.name }}</strong>, its items, its email log and any receipt files, for good. The shopper will no longer see it. This cannot be undone.</p>
      <p v-if="deleting.status === 'paid' || deleting.status === 'shipped'" class="mt-2 font-semibold text-danger">This order is {{ deleting.status === "shipped" ? "shipped" : "confirmed as paid" }}. Deleting it removes its payment record. If you only want to stop it, cancel it instead.</p>
      <p class="mt-2 text-ink-muted">The Change log records that you deleted it, without the shopper's details.</p>
    </ConfirmDialog>
    <OrderDialog v-if="open" :order="open" @close="openId = null" @changed="changed" />
  </div>
</template>
