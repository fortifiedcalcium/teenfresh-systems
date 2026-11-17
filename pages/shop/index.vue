<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { chipsFor, productImageUrl, productMatches } from "~/lib/products";
import { peso } from "~/lib/payment";
import { productPath } from "~/lib/slug";
import { groupVariations } from "~/lib/variations";
import { badgeFor, priceFor, priceText, stockLabel, cardCategories } from "~/lib/productBadge";
import { preorderNotice } from "~/lib/preorder";
import type { ProductRow, VariationRow } from "~/types/shop";

definePageMeta({ middleware: ["shop"] });
useSeo({ title: "Shop", description: "Official Teenfresh merch: albums, photocards, light sticks and more. Pay by GCash and we ship nationwide.", path: "/shop" });
const products = ref<ProductRow[] | null>(null);
const error = ref("");
const versions = ref<Record<string, VariationRow[]>>({});             // each product's versions, by product id
const route = useRoute();
// A product page links here with /shop?category=Merchandise, which opens the shop already filtered. Picking a chip here does not change the address.
const fromQuery = () => (typeof route.query.category === "string" && route.query.category ? route.query.category : "All");
const chip = ref(fromQuery());
watch(() => route.query.category, () => { chip.value = fromQuery(); });
const announce = useAnnounce();

async function fetchShop() {
  const [p, v, c] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("product_variations").select("*").eq("active", true).order("position"),
    supabase.from("product_categories").select("name").order("id"),
  ]);
  return { ok: !p.error, products: (p.data || []) as ProductRow[], versions: groupVariations((v.data || []) as VariationRow[]) as Record<string, VariationRow[]>, categories: ((c.data || []) as { name: string }[]).map((r) => r.name) };
}
// Loaded on the server, so the products are already in the page that search engines and link previews read. If the server could not reach the
// database, the browser asks again once the page is up.
const hydrating = useNuxtApp().isHydrating;
const { data, refresh } = await useAsyncData("shop-products", fetchShop);
const categories = ref<string[] | null>(null);
let retried = false;
watch(data, (d) => {
  if (!d) return;
  versions.value = d.versions; categories.value = d.categories;
  if (d.ok) { products.value = d.products; error.value = ""; return; }
  if (import.meta.client && (!hydrating || retried)) { error.value = "We could not load the products. Check your connection and refresh the page."; products.value = []; }
}, { immediate: true });
onMounted(async () => { if (hydrating && !data.value?.ok) { retried = true; await refresh(); } });

// Every category the admin made gets a chip (plus All and Pre-Order), even one with a single product or none yet: picking it says how many there are.
// (A rule added on 2026-11-13 hid a chip unless its category had two or more products; it made the chips vanish from a small shop.)
const chips = computed(() => chipsFor(categories.value));
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
    <div class="band band--mint py-8">
      <h1 id="shop-title" class="mb-1 flex items-center gap-2 text-3xl sm:text-4xl"><IconBag /><span>Teenfresh's products <span aria-hidden="true">⭐</span></span></h1>
    </div>
    <div class="shop-chips" role="group" aria-label="Filter products">
      <button v-for="c in chips" :key="c" type="button" class="shop-chip" :aria-pressed="chip === c" @click="pick(c)">{{ c }}</button>
    </div>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <Loading v-if="products === null" label="Loading products…" class="p-12" />
    <Empty v-else-if="shown.length === 0">{{ chip === "All" ? "No products yet. Check back soon!" : `No products in ${chip} yet.` }}</Empty>
    <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <li v-for="(p, i) in shown" :key="p.id">
        <ProductCard :title="p.title" :artist="p.artist" :categories="cardCategories(p)" :stock="stockLabel(p, opts(p))" :to="productPath(p)" :image="productImageUrl(p)" :image-alt="p.image_alt || ''" :tint="i"
          :price-label="priceText(priceFor(p.price, opts(p)), peso)" :discount="p.discount_percent > 0 ? p.discount_percent : undefined"
          :badge="badgeFor(p, opts(p))?.label" :badge-tone="badgeFor(p, opts(p))?.tone" :notice="preorderNotice(p)" />
      </li>
    </ul>
  </section>
</template>
