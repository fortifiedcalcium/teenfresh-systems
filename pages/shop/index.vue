<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient.js";
import { chipsFor, productImageUrl, productMatches } from "~/lib/products.js";
import { peso } from "~/lib/payment.js";
import { productPath } from "~/lib/slug";
import { groupVariations } from "~/lib/variations.js";
import { badgeFor, fromPrice } from "~/lib/productBadge";
import type { ProductRow, VariationRow } from "~/types/shop";

definePageMeta({ middleware: ["shop"] });
useSeo({ title: "Shop", description: "Official Teenfresh merch: albums, photocards, light sticks and more. Pay by GCash and we ship nationwide.", path: "/shop" });
const products = ref<ProductRow[] | null>(null);
const error = ref("");
const versions = ref<Record<string, VariationRow[]>>({});             // each product's versions, by product id
const chip = ref("All");
const announce = useAnnounce();
let alive = true;
onBeforeUnmount(() => { alive = false; });

onMounted(() => {
  supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).then(({ data, error: err }: { data: ProductRow[] | null; error: unknown }) => {
    if (!alive) return;
    if (err) { error.value = "We could not load the products. Check your connection and refresh the page."; products.value = []; return; }
    products.value = data || [];
  });
  supabase.from("product_variations").select("*").eq("active", true).order("position").then(({ data }: { data: VariationRow[] | null }) => { if (alive) versions.value = groupVariations(data || []); });
});

// "All" always shows; a category chip appears only once it has more than one product
const categories = useProductCategories();
const chips = computed(() => chipsFor(categories.value).filter((c: string) => c === "All" || (products.value || []).filter((p) => productMatches(p, c)).length > 1));
const shown = computed(() => (products.value || []).filter((p) => productMatches(p, chip.value)));
function pick(c: string) {
  chip.value = c;
  const n = (products.value || []).filter((p) => productMatches(p, c)).length;
  announce(`${c}: ${n} ${n === 1 ? "product" : "products"}`);
}
const opts = (p: ProductRow) => versions.value[p.id] || [];
</script>

<template>
  <section class="space-y-5" aria-labelledby="shop-title">
    <div class="rounded-[2rem] bg-brand-mint p-6 sm:p-8">
      <h1 id="shop-title" class="mb-1 flex items-center gap-2 text-3xl sm:text-4xl"><IconBag /><span>Teenfresh's products <span aria-hidden="true">⭐</span></span></h1>
      <p class="max-w-prose text-ink-muted">Official merch, paid by GCash. Pick a product to see its versions and add it to your cart.</p>
    </div>
    <div class="shop-chips" role="group" aria-label="Filter products">
      <button v-for="c in chips" :key="c" type="button" class="shop-chip" :aria-pressed="chip === c" @click="pick(c)">{{ c }}</button>
    </div>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <Loading v-if="products === null" label="Loading products…" class="p-12" />
    <Empty v-else-if="shown.length === 0">{{ chip === "All" ? "No products yet. Check back soon!" : `No products in ${chip} yet.` }}</Empty>
    <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="(p, i) in shown" :key="p.id">
        <ProductCard :title="p.title" :artist="p.artist" :to="productPath(p)" :image="productImageUrl(p)" :image-alt="p.image_alt || ''" :tint="i"
          :price-label="`${fromPrice(p.price, opts(p)) != null ? 'From ' : ''}${peso(fromPrice(p.price, opts(p)) ?? p.price)}`" :discount="p.discount_percent > 0 ? p.discount_percent : undefined"
          :badge="badgeFor(p, opts(p))?.label" :badge-tone="badgeFor(p, opts(p))?.tone" />
      </li>
    </ul>
  </section>
</template>
