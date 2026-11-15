<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { INFO_SECTIONS, productImageUrl } from "~/lib/products.js";
import { peso } from "~/lib/payment.js";
import { allSoldOut, inStock, normalizeLayers, stockNote, variationLabel } from "~/lib/variations.js";
import { MAX_QTY } from "~/lib/orders.js";
import { lineKey } from "~/lib/cartLine.js";

definePageMeta({ middleware: ["shop"] });
const unitPrice = (p) => Number(p.price);
const route = useRoute();
const { add, setQty } = useCart();
const toast = useToast();
const product = ref(undefined);   // undefined = loading, null = not found
const related = ref([]);
const error = ref("");
const qty = ref(1);
const variations = ref([]);       // this product's versions, in the admin's order
const choice = ref("");           // the id of the version the shopper picked (a simple product)
const picks = ref({});            // the value picked in each layer, like { Color: "Black" } (a product with layers)
const pickError = ref(false);
const group = ref(null);

watch(() => route.params.id, (id, _old, onCleanup) => {
  let alive = true;
  onCleanup(() => { alive = false; });
  product.value = undefined; error.value = ""; qty.value = 1; variations.value = []; choice.value = ""; picks.value = {}; pickError.value = false;
  supabase.from("product_variations").select("*").eq("product_id", id).eq("active", true).order("position").then(({ data }) => {
    if (!alive) return;
    const list = data || [];
    variations.value = list;
    if (list.length === 1) { choice.value = list[0].id; if (list[0].options) picks.value = { ...list[0].options }; }                          // only one version: no need to ask
  });
  supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).then(({ data, error: err }) => {
    if (!alive) return;
    if (err) { error.value = "We could not load this product. Check your connection and refresh the page."; product.value = null; return; }
    const all = data || [];
    const me = all.find((p) => p.id === id) || null;
    product.value = me;
    related.value = me ? all.filter((p) => p.id !== id && (p.artist === me.artist || (p.categories || []).some((c) => (me.categories || []).includes(c)))).slice(0, 4) : [];
  });
}, { immediate: true });

const p = computed(() => product.value);
const src = computed(() => (p.value ? productImageUrl(p.value) : null));
// layers (like Color, then Storage): the shopper picks a value in each, and the matching combination is what they buy
const layers = computed(() => normalizeLayers(p.value?.variation_layers || []));
const layered = computed(() => layers.value.length > 0 && variations.value.some((v) => v.options));
const soldOutAll = computed(() => allSoldOut(variations.value));                    // nothing is left in any version
const sellable = computed(() => variations.value.filter(inStock));                  // the versions with stock (or not counted): the only ones that can be bought
const fits = (v) => layers.value.every((l) => picks.value[l.name] === undefined || v.options?.[l.name] === picks.value[l.name]);
const matching = computed(() => (layered.value ? sellable.value.filter(fits) : sellable.value));       // the combinations still possible with what is picked so far
const selectedId = computed(() => (layered.value ? (layers.value.every((l) => picks.value[l.name]) ? matching.value.find((v) => layers.value.every((l) => v.options?.[l.name] === picks.value[l.name]))?.id || "" : "") : choice.value));
const chosen = computed(() => sellable.value.find((v) => v.id === selectedId.value) || null);
// A value that is in no combination for sale at all is greyed out. One that exists, but not together with what is picked in the other layers,
// says so and can still be picked: that clears the pick it does not go with (the way phone shops work).
const exists = (layer, value) => sellable.value.some((v) => v.options?.[layer.name] === value);
const soldOutValue = (layer, value) => !exists(layer, value) && variations.value.some((v) => v.options?.[layer.name] === value);          // it exists, but every combination with it is sold out
const goesWith = (layer, value) => sellable.value.some((v) => v.options?.[layer.name] === value && layers.value.every((l) => l.name === layer.name || picks.value[l.name] === undefined || v.options?.[l.name] === picks.value[l.name]));
const clash = (layer) => layers.value.filter((l) => l.name !== layer.name && picks.value[l.name] !== undefined).map((l) => picks.value[l.name]).join(" and ");
function pick(layer, value) {
  pickError.value = false;
  const next = { ...picks.value, [layer.name]: value };
  for (const l of layers.value) if (l.name !== layer.name && next[l.name] !== undefined && !sellable.value.some((v) => layers.value.every((m) => next[m.name] === undefined || v.options?.[m.name] === next[m.name]))) Reflect.deleteProperty(next, l.name);   // drop a pick the new one does not go with
  picks.value = next;
}
const missing = computed(() => layers.value.filter((l) => picks.value[l.name] === undefined).map((l) => l.name));
const unit = computed(() => (chosen.value?.price != null ? Number(chosen.value.price) : unitPrice(p.value)));
const prices = computed(() => (layered.value ? matching.value : variations.value).map((v) => (v.price != null ? Number(v.price) : unitPrice(p.value))));
const varies = computed(() => prices.value.length > 0 && Math.min(...prices.value) !== Math.max(...prices.value));
const maxQty = computed(() => (chosen.value && chosen.value.stock != null ? Math.max(1, Math.min(MAX_QTY, chosen.value.stock)) : MAX_QTY));       // no more than what is left
const total = computed(() => unit.value * Math.min(qty.value, maxQty.value));
const infoSections = computed(() => INFO_SECTIONS.filter(([k]) => p.value[k] || (k === "info_description" && (p.value.info_images || []).length > 0)));

// a product with versions needs one picked before it can go in the cart
function needPick() { if (variations.value.length && !selectedId.value) { pickError.value = true; group.value?.querySelector("input:not(:disabled)")?.focus(); return true; } return false; }
function addToCart() { add(p.value.id, selectedId.value || null); const n = Math.min(qty.value, maxQty.value); if (n > 1) setQty(lineKey({ id: p.value.id, vid: selectedId.value || null }), n); }   // add() puts one in; setQty tops it up to the chosen amount
function onAdd() { if (needPick()) return; addToCart(); toast(`${p.value.title}${chosen.value ? ` (${variationLabel(chosen.value)})` : ""} added to your cart`, "success"); }
function onBuy() { if (needPick()) return; addToCart(); navigateTo("/checkout"); }
</script>

<template>
  <Loading v-if="product === undefined" label="Loading product…" class="p-12" />
  <section v-else-if="!product" class="rounded-2xl border border-link bg-white p-4 sm:p-6">
    <Alert v-if="error" tone="bad" class="mb-4">{{ error }}</Alert>
    <Empty>This product is not available.</Empty>
    <p class="mt-4 text-center"><NuxtLink to="/shop" class="btn-secondary no-underline"><IconArrowLeft />Back to the shop</NuxtLink></p>
  </section>
  <section v-else class="rounded-2xl border border-link bg-white p-4 sm:p-6" aria-labelledby="product-title">
    <nav aria-label="Breadcrumb" class="mb-4">
      <NuxtLink to="/shop" class="btn-secondary no-underline"><IconArrowLeft />Shop</NuxtLink>
    </nav>
    <div class="pd-layout">
      <div class="pd-media">
        <img v-if="src" :src="src" :alt="p.image_alt || ''" class="h-full w-full object-cover">
        <div v-else class="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
      </div>

      <div class="pd-info">
        <p class="pd-artist">{{ p.artist }}</p>
        <div class="flex items-start gap-2">
          <h1 id="product-title" class="pd-title min-w-0 flex-1">{{ p.title }}</h1>
          <span v-if="p.is_new" class="shop-new mt-1">NEW</span>
        </div>

        <p class="pd-price">
          <span v-if="p.discount_percent > 0" class="text-danger"><span class="sr-only">Discount </span>{{ p.discount_percent }}%</span>
          <span><template v-if="!chosen && varies"><span class="text-base font-semibold">From </span>{{ peso(Math.min(...prices)) }}</template><template v-else>{{ peso(unit) }}</template></span>
        </p>

        <div v-if="p.pre_order" class="pd-status">
          <p class="pd-status-main">Pre-order<span aria-hidden="true"> ∙ </span><span class="font-normal">This is a pre-order product.</span></p>
        </div>

        <div v-if="variations.length > 0" ref="group" class="space-y-3" :aria-describedby="pickError ? 'pick-err' : undefined">
          <template v-if="layered">
            <fieldset v-for="l in layers" :key="l.name" class="pd-variations">
              <legend class="pd-label">Choose {{ l.name }} <span class="font-normal text-ink-muted">(required)</span></legend>
              <div class="flex flex-wrap gap-2">
                <label v-for="val in l.values" :key="val" :class="['flex min-h-target items-center gap-2 rounded-lg border border-link bg-white px-3 py-2 text-sm font-semibold has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-ivory', !exists(l, val) ? 'cursor-not-allowed opacity-60' : goesWith(l, val) ? 'cursor-pointer' : 'cursor-pointer opacity-70']">
                  <input type="radio" :name="`layer-${l.name}`" class="check" :value="val" :checked="picks[l.name] === val" :disabled="!exists(l, val)" @change="pick(l, val)">
                  <span>{{ val }}<span v-if="!exists(l, val)" class="ml-1 font-normal text-ink-muted">{{ soldOutValue(l, val) ? "(sold out)" : "(not available)" }}</span><span v-if="exists(l, val) && !goesWith(l, val)" class="ml-1 font-normal text-ink-muted">(not with {{ clash(l) }})</span></span>
                </label>
              </div>
            </fieldset>
          </template>
          <fieldset v-else class="pd-variations">
            <legend class="pd-label">Choose a version <span class="font-normal text-ink-muted">(required)</span></legend>
            <div class="flex flex-wrap gap-2">
              <label v-for="v in variations" :key="v.id" class="flex min-h-target cursor-pointer items-center gap-2 rounded-lg border border-link bg-white px-3 py-2 text-sm font-semibold has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-ivory">
                <input type="radio" name="variation" class="check" :value="v.id" :checked="choice === v.id" :disabled="!inStock(v)" @change="() => { choice = v.id; pickError = false; }">
                <span>{{ v.name }}<span v-if="!inStock(v)" class="ml-1 font-normal text-ink-muted">(sold out)</span><span v-if="v.price != null && Number(v.price) !== unitPrice(p)" class="ml-1 font-normal text-ink-muted">{{ peso(v.price) }}</span></span>
              </label>
            </div>
          </fieldset>
          <p v-if="pickError" id="pick-err" role="alert" class="field-msg"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ layered && missing.length ? `Choose ${missing.join(" and ")} first.` : "Choose a version first." }}</p>
        </div>
        <p v-if="soldOutAll" role="status" class="rounded-lg border border-danger bg-brand-ivory px-3 py-2 font-bold text-danger">Sold out. Every version is sold out for now.</p>
        <p v-if="chosen && stockNote(chosen)" role="status" class="text-sm font-bold">{{ stockNote(chosen) }}</p>
        <div class="pd-option">
          <p id="opt-label" class="pd-label">Select option</p>
          <div class="pd-option-row" role="group" aria-labelledby="opt-label">
            <span class="pd-option-name">{{ p.title }}{{ chosen ? ` · ${variationLabel(chosen)}` : "" }}</span>
            <div class="pd-qty">
              <button type="button" aria-label="Decrease quantity" :disabled="qty <= 1" @click="qty = Math.max(1, qty - 1)">−</button>
              <output aria-live="polite" aria-label="Quantity">{{ qty }}</output>
              <button type="button" aria-label="Increase quantity" :disabled="qty >= maxQty" @click="qty = Math.min(maxQty, qty + 1)">+</button>
            </div>
          </div>
        </div>

        <p class="pd-total"><span>Total</span><strong class="tabular-nums">{{ peso(total) }}</strong></p>

        <div class="pd-actions">
          <button type="button" class="btn-secondary" :disabled="soldOutAll" @click="onAdd"><IconCart />Add to cart</button>
          <button type="button" class="btn-primary" :disabled="soldOutAll" @click="onBuy">Buy now</button>
        </div>
      </div>
    </div>
    <div v-if="infoSections.length" class="pd-accordion">
      <details v-for="([k, label], i) in infoSections" :key="k" :open="i === 0">
        <summary>{{ label }}</summary>
        <div class="pd-prose">
          <template v-if="k === 'info_description'"><img v-for="(path, n) in p.info_images || []" :key="path" :src="productImageUrl({ image_path: path })" :alt="`${p.title}, detail ${n + 1}`" loading="lazy" class="pd-desc-img"></template>
          <FormattedText :text="p[k]" />
        </div>
      </details>
    </div>
    <section v-if="related.length" class="mt-8" aria-labelledby="related-title">
      <h2 id="related-title" class="mb-4 text-lg font-bold">Related products</h2>
      <ul class="shop-grid">
        <li v-for="r in related" :key="r.id">
          <NuxtLink :to="`/shop/${r.id}`" class="shop-card block">
            <div class="shop-thumb">
              <img v-if="productImageUrl(r)" :src="productImageUrl(r)" :alt="r.image_alt || ''" loading="lazy" class="shop-art h-full w-full object-cover">
              <div v-else class="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
            </div>
            <div class="flex flex-col gap-1 px-1 pb-2 pt-3">
              <p class="text-sm text-ink-muted">{{ r.artist }}</p>
              <p class="shop-title">{{ r.title }}</p>
              <p class="text-lg font-bold tabular-nums">{{ peso(unitPrice(r)) }}</p>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </section>
</template>
