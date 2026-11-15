<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { chipsFor, productMatches } from "~/lib/products.js";

definePageMeta({ middleware: ["shop"] });
const products = ref(null);
const error = ref("");
const versions = ref({});             // each product's versions, by product id
const chip = ref("All");
const announce = useAnnounce();
let alive = true;
onBeforeUnmount(() => { alive = false; });

onMounted(() => {
  supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).then(({ data, error: err }) => {
    if (!alive) return;
    if (err) { error.value = "We could not load the products. Check your connection and refresh the page."; products.value = []; return; }
    products.value = data || [];
  });
  supabase.from("product_variations").select("*").eq("active", true).order("position").then(({ data }) => { if (alive) versions.value = groupVariations(data || []); });
});

// "All" always shows; a category chip appears only once it has more than one product
const categories = useProductCategories();
const chips = computed(() => chipsFor(categories.value).filter((c) => c === "All" || (products.value || []).filter((p) => productMatches(p, c)).length > 1));
const shown = computed(() => (products.value || []).filter((p) => productMatches(p, chip.value)));
function pick(c) {
  chip.value = c;
  const n = (products.value || []).filter((p) => productMatches(p, c)).length;
  announce(`${c}: ${n} ${n === 1 ? "product" : "products"}`);
}
</script>

<template>
  <section class="rounded-2xl border border-link bg-white p-4 sm:p-6" aria-labelledby="shop-title">
    <h1 id="shop-title" class="mb-4 flex items-center gap-2 text-3xl"><IconBag /><span>Teenfresh's products <span aria-hidden="true">⭐</span></span></h1>
    <div class="shop-chips" role="group" aria-label="Filter products">
      <button v-for="c in chips" :key="c" type="button" class="shop-chip" :aria-pressed="chip === c" @click="pick(c)">{{ c }}</button>
    </div>
    <Alert v-if="error" tone="bad" class="mb-4">{{ error }}</Alert>
    <Loading v-if="products === null" label="Loading products…" class="p-12" />
    <Empty v-else-if="shown.length === 0">{{ chip === "All" ? "No products yet. Check back soon!" : `No products in ${chip} yet.` }}</Empty>
    <ul v-else class="shop-grid"><ProductCardLegacy v-for="p in shown" :key="p.id" :p="p" :options="versions[p.id] || []" /></ul>
  </section>
</template>
