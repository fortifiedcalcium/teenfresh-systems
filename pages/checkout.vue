<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { friendlyError } from "~/lib/api.js";
import { orderArgs, priceOrder, validateCheckout } from "~/lib/orders.js";
import { peso, receiptPath, validateReceiptFile } from "~/lib/payment.js";
import { variationLabel } from "~/lib/variations.js";
import { productImageUrl } from "~/lib/products.js";

definePageMeta({ middleware: ["shop", "auth"] });
const LABELS = { name: "Full name", email: "Email", phone: "Mobile number", address: "Street address", province: "Province", city: "City/Municipality", postal_code: "Postal code", sender_name: "GCash sender name", reference_number: "Reference number", receipt: "Payment receipt" };
const DELIVERY = ["name", "email", "phone", "address", "province", "city", "postal_code"];
const PAYMENT = ["sender_name", "reference_number", "receipt"];

const { user, profile } = useAuth();
const { items, clear } = useCart();
const state = useCartProducts();
const settings = useShopSettings();
const cartLines = useCartLines(computed(() => state.value.products), computed(() => state.value.variations));
const lines = computed(() => cartLines.value.lines);
const f = reactive({ name: profile.value?.full_name || "", email: user.value?.email || "", phone: "", address: "", province: "", city: "", postal_code: "", notes: "", sender_name: "", reference_number: "" });
const file = ref(null);
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const serverError = ref("");
const busy = ref(false);
const places = ref(null);                 // { province: [cities and municipalities] }, loaded when checkout opens
onMounted(async () => { places.value = (await import("~/data/ph-locations.json")).default; });
watch(() => f.province, () => { f.city = ""; });   // a new province starts with no city chosen

const totals = computed(() => priceOrder(lines.value));
const soldOut = computed(() => lines.value.filter((l) => l.stock === 0 || (l.stock != null && l.quantity > l.stock)));   // not enough left: the order would be refused
const paymentReady = computed(() => Boolean(settings.value?.gcash_account_number));
const flagCount = (keys) => keys.filter((k) => errors.value[k]).length;   // "2 fields need attention" beside a section's title, when it has problems

async function submit() {
  serverError.value = "";
  const errs = validateCheckout(f);
  const fileProblem = validateReceiptFile(file.value);
  if (fileProblem) errs.receipt = fileProblem;
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  busy.value = true;
  let path = null;
  try {
    path = receiptPath(user.value.id, file.value);
    const up = await supabase.storage.from("payment-receipts").upload(path, file.value, { contentType: file.value.type, upsert: false });
    if (up.error) throw new Error("We couldn't upload your receipt. Check your connection and the file, then try again.");
    const { data, error } = await supabase.rpc("place_order", orderArgs(f, items.value, path));
    if (error) throw error;
    clear();
    await navigateTo({ path: `/orders/${data.id}`, query: { placed: "1" } }, { replace: true });
  } catch (e) {
    if (path) supabase.storage.from("payment-receipts").remove([path]);      // do not leave an unused receipt behind
    serverError.value = friendlyError(e); bumpFocus(); busy.value = false;
  }
}
</script>

<template>
  <Loading v-if="state.products === null || !settings" label="Loading checkout…" class="p-12" />
  <Empty v-else-if="items.length === 0 || lines.length === 0">Your cart is empty. <NuxtLink to="/shop">Browse the shop</NuxtLink></Empty>
  <div v-else class="space-y-4">
    <h1 class="flex items-center gap-2 text-3xl"><IconCart />Checkout</h1>
    <Alert v-if="state.error" tone="bad">{{ state.error }}</Alert>
    <Alert v-if="soldOut.length > 0" tone="warn">{{ soldOut.map((l) => l.title).join(", ") }} {{ soldOut.length === 1 ? "is" : "are" }} sold out or has fewer left than your cart asks for. <NuxtLink to="/cart">Go back to your cart</NuxtLink> to fix it.</Alert>
    <Alert v-if="!paymentReady" tone="warn">Checkout is not open yet because the payment details are not set up. Please try again later.</Alert>
    <ErrorSummary :errors="errors" :labels="LABELS" :field-ids="{ receipt: 'receipt' }" :extra="serverError" :focus-signal="focusSignal" />
    <form novalidate class="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start" @submit.prevent="submit">
      <div class="space-y-6">
        <fieldset class="card space-y-4 p-4"><legend class="px-1 text-lg font-black">Contact and delivery<span v-if="flagCount(DELIVERY) > 0" class="ml-2 inline-flex items-center gap-1 text-sm font-bold" style="color: var(--error-red)"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ flagCount(DELIVERY) }} {{ flagCount(DELIVERY) === 1 ? "field needs" : "fields need" }} attention</span></legend>
          <div class="grid gap-4 md:grid-cols-3">
            <Field id="name" v-slot="a" label="Full name" required :error="errors.name"><input v-bind="a" v-model="f.name" class="input" autocomplete="name"></Field>
            <Field id="email" v-slot="a" label="Email" required :error="errors.email"><input v-bind="a" v-model="f.email" class="input" type="email" autocomplete="email"></Field>
            <Field id="phone" v-slot="a" label="Mobile number" required :error="errors.phone" hint="For example 09171234567"><input v-bind="a" v-model="f.phone" class="input" type="tel" autocomplete="tel" inputmode="tel"></Field>
          </div>
          <Field id="address" v-slot="a" label="Street address" required :error="errors.address" hint="Unit/Blk No, Street, Barangay/District"><input v-bind="a" v-model="f.address" class="input" autocomplete="street-address"></Field>
          <div class="grid gap-4 md:grid-cols-3">
            <Field id="province" v-slot="a" label="Province" required :error="errors.province">
              <select v-bind="a" v-model="f.province" class="input" autocomplete="address-level1" :disabled="!places">
                <option value="">{{ places ? "Choose your province…" : "Loading provinces…" }}</option>
                <option v-for="p in places ? Object.keys(places) : []" :key="p" :value="p">{{ p }}</option>
              </select>
            </Field>
            <Field id="city" v-slot="a" label="City/Municipality" required :error="errors.city">
              <select v-bind="a" v-model="f.city" class="input" autocomplete="address-level2" :disabled="!places || !f.province">
                <option value="">{{ f.province ? "Choose your city or municipality…" : "Choose a province first" }}</option>
                <option v-for="c in places && f.province ? places[f.province] || [] : []" :key="c" :value="c">{{ c }}</option>
              </select>
            </Field>
            <Field id="postal_code" v-slot="a" label="Postal code" required :error="errors.postal_code"><input v-bind="a" v-model="f.postal_code" class="input" autocomplete="postal-code" inputmode="numeric" maxlength="4"></Field>
          </div>
          <Field id="notes" v-slot="a" label="Notes for the seller" hint="Optional"><textarea v-bind="a" v-model="f.notes" class="input" rows="2" maxlength="500" /></Field>
        </fieldset>

        <fieldset class="card space-y-4 p-4"><legend class="px-1 text-lg font-black">Pay with GCash<span v-if="flagCount(PAYMENT) > 0" class="ml-2 inline-flex items-center gap-1 text-sm font-bold" style="color: var(--error-red)"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ flagCount(PAYMENT) }} {{ flagCount(PAYMENT) === 1 ? "field needs" : "fields need" }} attention</span></legend>
          <div v-if="paymentReady" class="rounded-lg bg-brand-sky p-3 text-sm">
            <p>Send <strong>{{ peso(totals.totalPhp) }}</strong> to:</p>
            <p class="mt-1 font-bold">{{ settings.gcash_account_name || "Teenfresh" }}</p>
            <p class="flex flex-wrap items-center gap-2"><span class="font-mono text-base font-bold">{{ settings.gcash_account_number }}</span><CopyButton :text="settings.gcash_account_number" label="Copy GCash number" /></p>
            <figure v-if="settings.gcash_qr_path" class="mt-3 w-48 max-w-full">
              <img :src="productImageUrl({ image_path: settings.gcash_qr_path })" :alt="`GCash QR code for ${settings.gcash_account_name || 'Teenfresh'}. Scan it in the GCash app to pay.`" class="w-full rounded-lg border border-link bg-white">
              <figcaption class="mt-1 text-sm">Or scan this QR code in the GCash app.</figcaption>
            </figure>
            <p class="mt-2">Then enter the details below and attach your receipt. We check it within 48 to 72 hours.</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <Field id="sender_name" v-slot="a" label="GCash sender name" required :error="errors.sender_name" hint="The name on the account you paid from"><input v-bind="a" v-model="f.sender_name" class="input"></Field>
            <Field id="reference_number" v-slot="a" label="Reference number" required :error="errors.reference_number"><input v-bind="a" v-model="f.reference_number" class="input" autocomplete="off"></Field>
          </div>
          <FileUpload id="receipt" v-model="file" :error="errors.receipt" />
        </fieldset>
      </div>

      <aside class="card space-y-3 p-4 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 class="text-lg font-black">Your order</h2>
        <ul class="space-y-2">
          <li v-for="l in lines" :key="l.key" class="flex items-center gap-3 text-sm"><LineThumb :p="l" /><span class="min-w-0 flex-1"><span class="block break-words font-bold">{{ l.title }}</span><span v-if="l.variation" class="block font-semibold">{{ l.variation.options ? variationLabel(l.variation) : `Version: ${l.variation.name}` }}</span><span class="text-ink-muted">{{ peso(l.price) }} × {{ l.quantity }}</span></span></li>
        </ul>
        <OrderTotals :totals="totals" />
        <button class="btn-primary w-full" :disabled="busy || !paymentReady || soldOut.length > 0"><IconSend />{{ busy ? "Placing order…" : "Place order" }}</button>
        <NuxtLink to="/cart" class="btn-secondary w-full no-underline">Back to cart</NuxtLink>
      </aside>
    </form>
  </div>
</template>
