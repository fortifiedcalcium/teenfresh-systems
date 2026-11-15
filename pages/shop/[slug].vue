<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { INFO_SECTIONS, productImageUrl } from "~/lib/products";
import { peso } from "~/lib/payment";
import { groupVariations, inStock, normalizeLayers, stockNote, variationLabel } from "~/lib/variations";
import { MAX_QTY } from "~/lib/orders";
import { findByRef, productPath } from "~/lib/slug";
import { lineKey } from "~/lib/cartLine";
import { badgeFor, isSoldOut, priceFor, priceText } from "~/lib/productBadge";
import { preorderBuyable, preorderNotice, preorderState } from "~/lib/preorder";

definePageMeta({ middleware: ["shop"] });
const unitPrice = (p) => Number(p.price);
const route = useRoute();
const { add, setQty } = useCart();
const toast = useToast();
const product = ref(undefined);   // undefined = loading, null = not found
const related = ref([]);
const relatedVersions = ref({});
const error = ref("");
const qty = ref(1);
const variations = ref([]);       // this product's versions, in the admin's order
const choice = ref("");           // the id of the version the shopper picked (a simple product)
const picks = ref({});            // the value picked in each layer, like { Color: "Black" } (a product with layers)
const pickError = ref(false);
const group = ref(null);

async function fetchProduct(slug: string) {
  // the address holds the product's slug (or, from an old link, its id)
  const { data, error: err } = await supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
  if (err) return { ok: false };
  const all = data || [];
  const me = findByRef(all, slug) || null;
  if (!me) return { ok: true, product: null, related: [], variations: [], relatedVersions: {} };
  const v = await supabase.from("product_variations").select("*").eq("product_id", me.id).eq("active", true).order("position");
  const related = all.filter((x) => x.id !== me.id && (x.artist === me.artist || (x.categories || []).some((c) => (me.categories || []).includes(c)))).slice(0, 4);
  // the related products' versions too, so their cards show the same price range as the shop
  const rv = related.length ? await supabase.from("product_variations").select("*").in("product_id", related.map((x) => x.id)).eq("active", true).order("position") : { data: [] };
  return { ok: true, product: me, related, variations: v.data || [], relatedVersions: groupVariations(rv.data || []) };
}
// Loaded on the server, so the product is already in the page that search engines and link previews read. If the server could not reach the
// database, the browser asks again once the page is up.
const hydrating = useNuxtApp().isHydrating;
const { data: loaded, refresh } = await useAsyncData(`product-${route.params.slug}`, () => fetchProduct(String(route.params.slug)));
let retried = false;
function apply(d) {
  if (!d) return;
  if (!d.ok) { if (import.meta.client && (!hydrating || retried)) { error.value = "We could not load this product. Check your connection and refresh the page."; product.value = null; } return; }
  product.value = d.product; related.value = d.related; relatedVersions.value = d.relatedVersions || {}; variations.value = d.variations;
  if (d.variations.length === 1) { choice.value = d.variations[0].id; if (d.variations[0].options) picks.value = { ...d.variations[0].options }; }   // only one version: no need to ask
}
apply(loaded.value);
// an old id address moves to the slug (a permanent redirect, so search engines follow it)
if (loaded.value?.product?.slug && loaded.value.product.slug !== route.params.slug) await navigateTo(productPath(loaded.value.product), { replace: true, redirectCode: 301 });
// a product that does not exist is a real 404 for search engines (the page still shows a friendly message)
if (import.meta.server && loaded.value?.ok && !loaded.value.product) setResponseStatus(useRequestEvent(), 404);
onMounted(async () => { if (hydrating && !loaded.value?.ok) { retried = true; await refresh(); apply(loaded.value); } });

const p = computed(() => product.value);
const badge = computed(() => (product.value ? badgeFor(product.value, variations.value) : null));
const src = computed(() => (p.value ? productImageUrl(p.value) : null));
// layers (like Color, then Storage): the shopper picks a value in each, and the matching combination is what they buy
const layers = computed(() => normalizeLayers(p.value?.variation_layers || []));
const layered = computed(() => layers.value.length > 0 && variations.value.some((v) => v.options));
const soldOutAll = computed(() => isSoldOut(p.value || {}, variations.value));    // every version is at 0, or the product (with no versions) is at 0
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
// before a version is picked: the lowest price among the versions still in stock (all of them when everything is sold out)
const shownPrice = computed(() => priceFor(p.value.price, layered.value && matching.value.length ? matching.value : variations.value));
const left = computed(() => (chosen.value ? chosen.value.stock : variations.value.length === 0 ? p.value.stock : null));        // what is left of what is being bought, null = not counted
const maxQty = computed(() => (left.value != null ? Math.max(1, Math.min(MAX_QTY, left.value)) : MAX_QTY));                    // no more than what is left
const preorderDay = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
const poState = computed(() => preorderState(p.value));
const qtyLocked = computed(() => variations.value.length > 0 && !selectedId.value);        // pick a version first; then the quantity (a product with no versions is never locked)
watch(selectedId, () => { qty.value = 1; });                                                   // a new pick starts again at 1, so it cannot exceed what that version has left
const canBuy = computed(() => !soldOutAll.value && preorderBuyable(p.value));
const total = computed(() => unit.value * Math.min(qty.value, maxQty.value));
const infoSections = computed(() => INFO_SECTIONS.filter(([k]) => p.value[k] || (k === "info_description" && (p.value.info_images || []).length > 0)));

const site = String(useRuntimeConfig().public.siteUrl || "").replace(/\/$/, "");
const plain = (s) => String(s || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
useSeo({
  title: () => (product.value ? `${product.value.title} (${product.value.artist})` : "Product"),
  description: () => (product.value ? plain(product.value.info_description).slice(0, 200) || `${product.value.title} by ${product.value.artist}. Official Teenfresh merch, paid by GCash.` : undefined),
  image: src, path: () => (product.value ? productPath(product.value) : route.path), type: "product",
  jsonLd: () => {
    const x = product.value;
    if (!x) return null;
    const list = variations.value;
    const open = list.filter(inStock);                                      // the prices on offer are those still in stock (all of them when none is)
    const prices = (open.length ? open : list).map((v) => (v.price != null ? Number(v.price) : Number(x.price)));
    if (!prices.length) prices.push(Number(x.price));
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const available = !isSoldOut(x, list) && preorderBuyable(x);
    const common = { priceCurrency: "PHP", availability: !available ? "https://schema.org/SoldOut" : preorderState(x) === "open" ? "https://schema.org/PreOrder" : "https://schema.org/InStock", url: `${site}${productPath(x)}` };
    return {
      "@context": "https://schema.org", "@type": "Product", name: x.title, brand: { "@type": "Brand", name: x.artist }, image: src.value ? [src.value] : undefined,
      description: plain(x.info_description) || undefined,
      offers: lo === hi ? { "@type": "Offer", price: String(lo), ...common } : { "@type": "AggregateOffer", lowPrice: String(lo), highPrice: String(hi), offerCount: list.length, ...common },
    };
  },
});

// a product with versions needs one picked before it can go in the cart
function needPick() { if (variations.value.length && !selectedId.value) { pickError.value = true; group.value?.querySelector("input:not(:disabled)")?.focus(); return true; } return false; }
function addToCart() { add(p.value.id, selectedId.value || null); const n = Math.min(qty.value, maxQty.value); if (n > 1) setQty(lineKey({ id: p.value.id, vid: selectedId.value || null }), n); }   // add() puts one in; setQty tops it up to the chosen amount
function onAdd() { if (!canBuy.value || needPick()) return; addToCart(); toast(`${p.value.title}${chosen.value ? ` (${variationLabel(chosen.value)})` : ""} added to your cart`, "success"); }
function onBuy() { if (!canBuy.value || needPick()) return; addToCart(); navigateTo("/checkout"); }
</script>

<template>
  <Loading v-if="product === undefined" label="Loading product…" class="p-12" />
  <section v-else-if="!product" class="rounded-2xl border border-link bg-white p-4 sm:p-6">
    <Alert v-if="error" tone="bad" class="mb-4">{{ error }}</Alert>
    <Empty>This product is not available.</Empty>
    <p class="mt-4 text-center"><BaseButton to="/shop" variant="secondary"><IconArrowLeft />Back to the shop</BaseButton></p>
  </section>
  <section v-else class="rounded-[2rem] bg-white p-4 shadow-[0_6px_20px_color-mix(in_srgb,var(--ink)_12%,transparent)] sm:p-6" aria-labelledby="product-title">
    <nav aria-label="Breadcrumb" class="mb-4">
      <BaseButton to="/shop" variant="ghost" small><IconArrowLeft />Shop</BaseButton>
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
          <span v-if="badge" class="mt-1"><StatusChip :tone="badge.tone">{{ badge.label }}</StatusChip></span>
        </div>

        <p class="pd-price">
          <span v-if="p.discount_percent > 0" class="text-danger"><span class="sr-only">Discount </span>{{ p.discount_percent }}%</span>
          <span><template v-if="!chosen && variations.length">{{ priceText(shownPrice, peso) }}</template><template v-else>{{ peso(unit) }}</template></span>
        </p>

        <div v-if="p.pre_order" class="pd-status">
          <p v-if="poState === 'open'" class="pd-status-main">Pre-order<span aria-hidden="true"> ∙ </span><span class="font-normal">This is a pre-order product{{ p.pre_order_ends_on ? `, open until ${preorderDay(p.pre_order_ends_on)}` : "" }}.</span></p>
          <p v-else role="status" class="pd-status-main">{{ preorderNotice(p) }}<span aria-hidden="true"> ∙ </span><span class="font-normal">{{ poState === "ended" ? "It can no longer be ordered." : "It cannot be ordered yet." }}</span></p>
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
        <p v-if="soldOutAll" role="status" class="rounded-lg border border-danger bg-brand-ivory px-3 py-2 font-bold text-danger">{{ variations.length ? "Sold out. Every version is sold out for now." : "Sold out for now." }}</p>
        <p v-if="stockNote({ stock: left })" role="status" class="text-sm font-bold">{{ stockNote({ stock: left }) }}</p>
        <div class="pd-option">
          <p id="opt-label" class="pd-label">Select option</p>
          <div class="pd-option-row" role="group" aria-labelledby="opt-label">
            <span class="pd-option-name">{{ p.title }}{{ chosen ? ` · ${variationLabel(chosen)}` : "" }}</span>
            <div class="pd-qty">
              <button type="button" aria-label="Decrease quantity" :disabled="qtyLocked || qty <= 1" @click="qty = Math.max(1, qty - 1)">−</button>
              <output aria-live="polite" aria-label="Quantity">{{ qty }}</output>
              <button type="button" aria-label="Increase quantity" :disabled="qtyLocked || qty >= maxQty" @click="qty = Math.min(maxQty, qty + 1)">+</button>
            </div>
          </div>
        </div>

        <p v-if="qtyLocked" class="text-sm text-ink-muted">Choose {{ layered ? "an option in each group" : "a version" }} above to set the quantity.</p>
        <p class="pd-total"><span>Total</span><strong class="tabular-nums">{{ qtyLocked ? "—" : peso(total) }}</strong></p>

        <div class="pd-actions">
          <BaseButton variant="secondary" :disabled="!canBuy" @click="onAdd"><IconCart />Add to cart</BaseButton>
          <BaseButton variant="accent" :disabled="!canBuy" @click="onBuy">Buy now</BaseButton>
        </div>
      </div>
    </div>
    <div v-if="infoSections.length" class="pd-accordion">
      <details v-for="([k, label], i) in infoSections" :key="k" :open="i === 0">
        <summary>{{ label }}</summary>
        <div class="pd-prose">
          <template v-if="k === 'info_description'"><img v-for="(path, n) in p.info_images || []" :key="path" :src="productImageUrl({ image_path: path })" :alt="`${p.title}, detail ${Number(n) + 1}`" loading="lazy" class="pd-desc-img"></template>
          <FormattedText :text="p[k]" />
        </div>
      </details>
    </div>
    <section v-if="related.length" class="mt-8" aria-labelledby="related-title">
      <h2 id="related-title" class="mb-4 text-lg font-bold">Related products</h2>
      <ul class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <li v-for="(r, i) in related" :key="r.id"><ProductCard :title="r.title" :artist="r.artist" :to="productPath(r)" :image="productImageUrl(r)" :image-alt="r.image_alt || ''" :tint="i" :price-label="priceText(priceFor(r.price, relatedVersions[r.id] || []), peso)" /></li>
      </ul>
    </section>
  </section>
</template>
