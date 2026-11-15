<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { VARIATIONS_MAX, CATEGORY_MAX, INFO_IMAGES_MAX, INFO_MAX, INFO_SECTIONS, productImageUrl, productRow, removeProductImage, uploadProductImage, validateCategoryName, validateProduct } from "~/lib/products.js";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, validateImageFile } from "~/lib/eventImages.js";
import { peso } from "~/lib/payment.js";
import { COMBOS_MAX, LAYERS_MAX, LAYER_VALUES_MAX, buildCombos, finalVariations, groupVariations, normalizeLayers, validateLayers } from "~/lib/variations.js";
import { blankProduct, productToForm } from "~/lib/productForm.js";

// Admin: add, edit, hide and delete the products on the public Shop page.
definePageMeta({ middleware: ["shop"] });
const ACCEPT = Object.keys(IMAGE_TYPES).join(",");
const toast = useToast();
const announce = useAnnounce();
const rows = ref(null);
const form = ref(null);       // null = closed; object = new (no id) or editing
const file = ref(null);       // a newly chosen image, not uploaded until Save
const preview = ref(null);
const descFiles = ref([]);    // new description images { file, url }, not uploaded until Save
const fileError = ref("");
const errors = ref({});
const [focusSignal, bumpFocus] = useErrorFocus();
const saving = ref(false);
const formError = ref("");
const deleting = ref(null);
const versions = ref({});     // each product's variations, by product id
let newKey = 0;

async function load() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) { toast("Could not load the products: " + error.message, "error"); rows.value = []; return; }
  const v = await supabase.from("product_variations").select("*").order("position");        // every version, hidden ones too (an admin sees all)
  versions.value = groupVariations(v.data || []);
  rows.value = data || [];
}
onMounted(load);

// ---- the categories an admin can tick (add and delete them right in the form)
const cats = ref(null);                 // names, in the order they were made
const newCat = ref("");
const catError = ref("");
const confirmCat = ref(null);           // the category waiting for "Yes, delete"
const catBusy = ref(false);
async function loadCats() {
  const { data, error } = await supabase.from("product_categories").select("name").order("id");
  if (error) { toast("Could not load the categories: " + error.message, "error"); cats.value = []; return; }
  cats.value = (data || []).map((r) => r.name);
}
onMounted(loadCats);

watch(file, (f, _o, onCleanup) => {
  if (!f) { preview.value = null; return; }
  const url = URL.createObjectURL(f);
  preview.value = url;
  onCleanup(() => URL.revokeObjectURL(url));
});
onBeforeUnmount(() => descFiles.value.forEach((d) => URL.revokeObjectURL(d.url)));

const clearDesc = () => { descFiles.value.forEach((d) => URL.revokeObjectURL(d.url)); descFiles.value = []; };
function open(p) { clearDesc(); form.value = p ? productToForm(p, versions.value[p.id] || []) : blankProduct(); file.value = null; fileError.value = ""; errors.value = {}; formError.value = ""; }
function close() { clearDesc(); form.value = null; }
async function addCategory() {
  const problem = validateCategoryName(newCat.value, cats.value || []);
  if (problem) { catError.value = problem; announce(problem, "assertive"); return; }
  catBusy.value = true; catError.value = "";
  const name = newCat.value.trim();
  const { error } = await supabase.from("product_categories").insert({ name });
  catBusy.value = false;
  if (error) { const m = error.code === "23505" ? "That category already exists." : error.message; catError.value = m; announce(m, "assertive"); return; }
  newCat.value = "";
  if (!form.value.categories.includes(name)) form.value.categories.push(name);   // tick it for this product
  announce(`Category ${name} added`);
  await loadCats();
}
async function deleteCategory(name) {
  catBusy.value = true; catError.value = "";
  const { error } = await supabase.rpc("delete_product_category", { p_name: name });
  catBusy.value = false; confirmCat.value = null;
  if (error) { catError.value = error.message; return; }
  form.value.categories = form.value.categories.filter((x) => x !== name);
  toast(`Category ${name} deleted`, "success");
  await Promise.all([loadCats(), load()]);
}
const toggleCategory = (c) => { const f = form.value; f.categories = f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c]; };
const categoryList = computed(() => [...(cats.value || []), ...(form.value?.categories || []).filter((c) => !(cats.value || []).includes(c))]);
const usedBy = (c) => (rows.value || []).filter((p) => (p.categories || []).includes(c)).length;

function takeDesc(list) {
  const room = INFO_IMAGES_MAX - form.value.info_images.length - descFiles.value.length;
  const picked = [];
  for (const f of list) {
    const bad = validateImageFile(f);
    if (bad) { fileError.value = `${f.name}: ${bad}`; announce(bad, "assertive"); continue; }
    if (picked.length >= room) { fileError.value = `A product can have up to ${INFO_IMAGES_MAX} description images`; break; }
    picked.push({ file: f, url: URL.createObjectURL(f) });
  }
  if (picked.length) { fileError.value = ""; descFiles.value = [...descFiles.value, ...picked]; announce(`Added ${picked.length} ${picked.length === 1 ? "image" : "images"}`); }
}
const dropDesc = (d) => { URL.revokeObjectURL(d.url); descFiles.value = descFiles.value.filter((x) => x !== d); };
const dropSaved = (path) => { form.value.info_images = form.value.info_images.filter((x) => x !== path); };
function take(f) {
  const bad = validateImageFile(f);
  if (bad) { fileError.value = bad; announce(bad, "assertive"); return; }
  fileError.value = ""; file.value = f; announce(`Selected ${f.name}`);
}
const onImage = (e) => { if (e.target.files?.[0]) take(e.target.files[0]); e.target.value = ""; };
const onDescImages = (e) => { takeDesc([...e.target.files]); e.target.value = ""; };

async function save() {
  formError.value = "";
  const f = form.value;
  const errs = validateProduct(f);
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  saving.value = true;
  let newPath = null;
  const newDesc = [];
  try {
    const row = productRow(f);
    if (file.value) { newPath = await uploadProductImage(file.value); row.image_path = newPath; }
    for (const d of descFiles.value) newDesc.push(await uploadProductImage(d.file));
    row.info_images = [...f.info_images, ...newDesc];
    const saved = f.id ? await supabase.from("products").update(row).eq("id", f.id) : await supabase.from("products").insert(row).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    const productId = f.id || saved.data?.id;
    // the product is saved; now its variations: remove the ones taken out, update the ones kept, add the new ones, in the order shown
    const list = finalVariations(f);                                       // the combinations of the layers, or the simple list
    const keep = new Set(list.filter((v) => v.id).map((v) => v.id));
    const gone = (versions.value[f.id] || []).filter((v) => !keep.has(v.id)).map((v) => v.id);
    const failed = [];
    if (gone.length) { const r = await supabase.from("product_variations").delete().in("id", gone); if (r.error) failed.push(r.error.message); }
    for (const [i, v] of list.entries()) {
      const body = { name: v.name.trim(), price: String(v.price).trim() === "" ? null : Number(v.price), stock: String(v.stock ?? "").trim() === "" ? null : Number(v.stock), position: i, active: v.active, options: v.options };
      const r = v.id ? await supabase.from("product_variations").update(body).eq("id", v.id) : await supabase.from("product_variations").insert({ ...body, product_id: productId });
      if (r.error) failed.push(r.error.message);
    }
    if (failed.length) throw new Error(`The product was saved, but its variations were not: ${failed[0]}`);
    if (newPath && f.image_path) await removeProductImage(f.image_path);   // tidy up the replaced file
    const before = rows.value.find((r) => r.id === f.id)?.info_images || [];
    await Promise.all(before.filter((x) => !f.info_images.includes(x)).map(removeProductImage));   // and description images that were removed
    toast(f.id ? "Product saved" : "Product added", "success");
    clearDesc(); form.value = null;
    await load();
  } catch (e) {
    await Promise.all([newPath, ...newDesc].filter(Boolean).map(removeProductImage));                              // do not leave an orphaned upload behind
    formError.value = e.message || "Could not save the product";
  } finally { saving.value = false; }
}
async function toggleActive(p) {
  const { error } = await supabase.from("products").update({ active: !p.active, updated_at: new Date().toISOString() }).eq("id", p.id);
  if (error) toast(error.message, "error"); else { toast(p.active ? "Hidden from the shop" : "Visible in the shop", "success"); load(); }
}
async function remove() {
  const d = deleting.value;
  const { error } = await supabase.from("products").delete().eq("id", d.id);
  if (error) toast(error.message, "error");
  else { await Promise.all([d.image_path, ...(d.info_images || [])].map(removeProductImage)); toast("Product deleted", "success"); load(); }
  deleting.value = null;
}

const shownImage = computed(() => preview.value || (form.value?.image_path ? productImageUrl(form.value) : null));
const summaryErrors = computed(() => Object.fromEntries(Object.entries(errors.value).map(([k, message]) => [`p-${k}`, message])));
const versionsOf = (p) => versions.value[p.id] || [];
const allSold = (p) => { const on = versionsOf(p).filter((v) => v.active !== false); return on.length > 0 && on.every((v) => v.stock === 0); };

// layers and combinations
const layersN = computed(() => (form.value ? normalizeLayers(form.value.layers) : []));
const comboRows = computed(() => (layersN.value.length && !validateLayers(layersN.value) ? buildCombos(layersN.value) : []));
const comboOf = (key) => form.value.combos[key] || {};
function setCombo(key, patch) { form.value.combos = { ...form.value.combos, [key]: { id: null, price: "", active: true, ...(form.value.combos[key] || {}), ...patch } }; }
const addVariation = () => form.value.variations.push({ key: `n${newKey++}`, id: null, name: "", price: "", stock: "" });
const removeVariation = (v) => { form.value.variations = form.value.variations.filter((x) => x.key !== v.key); };
const addLayer = () => form.value.layers.push({ key: `nl${newKey++}`, name: "", values: "" });
const removeLayer = (l) => { form.value.layers = form.value.layers.filter((x) => x.key !== l.key); };
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="flex items-center gap-2 text-2xl"><IconBag />Shop products</h1>
      <button type="button" class="btn-primary" @click="open(null)"><IconPlus />Add a product</button>
    </div>
    <p class="text-sm text-ink-muted">These appear on the public Shop page. Prices are in Philippine pesos. A hidden product stays here but is not shown to visitors.</p>

    <Loading v-if="rows === null" label="Loading products…" />
    <Empty v-else-if="rows.length === 0">No products yet. Add the first one.</Empty>
    <ul v-else class="space-y-3">
      <li v-for="p in rows" :key="p.id" class="card flex flex-wrap items-center gap-3 p-3">
        <img v-if="productImageUrl(p)" :src="productImageUrl(p)" alt="" class="h-16 w-16 shrink-0 rounded-lg border border-link object-cover">
        <div v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-link bg-brand-ivory text-link" aria-hidden="true"><IconImage /></div>
        <div class="min-w-0 flex-1">
          <h2 class="break-words text-base font-black">{{ p.title }}</h2>
          <p class="text-sm text-ink-muted">{{ p.artist }} · {{ peso(p.price) }}{{ p.discount_percent > 0 ? ` · ${p.discount_percent}% off` : "" }}</p>
          <p class="mt-1 flex flex-wrap gap-1">
            <span :class="['badge', p.active ? 'badge-ok' : 'badge-neutral']">{{ p.active ? "Visible" : "Hidden" }}</span>
            <span v-if="p.pre_order" class="badge badge-info">Pre-order</span>
            <span v-if="p.is_new" class="badge badge-info">New</span>
            <span v-if="allSold(p)" class="badge badge-neutral">Sold out</span>
            <span v-if="versionsOf(p).length > 0" class="badge badge-neutral">{{ versionsOf(p).length }} {{ versionsOf(p).length === 1 ? "variation" : "variations" }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secondary" @click="toggleActive(p)">{{ p.active ? "Hide" : "Show" }}<span class="sr-only"> {{ p.title }}</span></button>
          <button type="button" class="btn-secondary" @click="open(p)"><IconPencil />Edit <span class="sr-only">{{ p.title }}</span></button>
          <button type="button" class="btn-danger" @click="deleting = p"><IconTrash />Delete <span class="sr-only">{{ p.title }}</span></button>
        </div>
      </li>
    </ul>

    <Modal v-if="form" :title="form.id ? 'Edit product' : 'Add a product'" wide @close="close">
      <form class="space-y-5" novalidate @submit.prevent="save">
        <Alert v-if="formError" tone="bad">{{ formError }}</Alert>
        <ErrorSummary :errors="summaryErrors" :focus-signal="focusSignal" />
        <div class="grid gap-4 md:grid-cols-2">
          <Field id="p-artist" v-slot="a" label="Artist" required :error="errors.artist"><input v-bind="a" v-model="form.artist" class="input" maxlength="80"></Field>
          <Field id="p-title" v-slot="a" label="Product title" required :error="errors.title"><input v-bind="a" v-model="form.title" class="input" maxlength="160"></Field>
          <Field id="p-price" v-slot="a" label="Price (PHP)" required :error="errors.price" hint="The price shown to visitors, for example 750"><input v-bind="a" v-model="form.price" class="input" inputmode="decimal"></Field>
          <Field id="p-discount_percent" v-slot="a" label="Discount (%)" :error="errors.discount_percent" hint="Shown in red next to the price. 0 hides it"><input v-bind="a" v-model="form.discount_percent" class="input" inputmode="numeric"></Field>
        </div>

        <fieldset class="space-y-2">
          <legend class="label">Categories <span class="font-normal text-ink-muted">(the shop filters)</span></legend>
          <div class="flex flex-wrap gap-x-5 gap-y-1">
            <label v-for="c in categoryList" :key="c" class="flex min-h-target items-center gap-2 text-sm"><input type="checkbox" class="check" :checked="form.categories.includes(c)" @change="toggleCategory(c)">{{ c }}</label>
            <p v-if="cats && cats.length === 0" class="text-sm text-ink-muted">No categories yet. Add one below.</p>
          </div>
          <p class="hint">The Pre-Order filter uses the Pre-order switch below.</p>
          <details class="rounded-lg border border-brand-sky p-3">
            <summary class="cursor-pointer text-sm font-bold">Add or delete categories</summary>
            <div class="mt-3 space-y-3">
              <Alert v-if="catError" tone="bad">{{ catError }}</Alert>
              <InputWithAction id="new-category" v-model="newCat" label="New category" :hint="`Up to ${CATEGORY_MAX} characters. It also becomes a filter on the shop page.`" input-class="input w-64 max-w-full" :maxlength="CATEGORY_MAX" @keydown.enter.prevent="addCategory">
                <template #action><button type="button" class="btn-secondary" :disabled="catBusy" @click="addCategory"><IconPlus />Add category</button></template>
              </InputWithAction>
              <ul v-if="cats && cats.length > 0" class="space-y-1">
                <li v-for="c in cats" :key="c" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-brand-ivory px-3 py-1 text-sm">
                  <span class="font-semibold">{{ c }} <span class="font-normal text-ink-muted">· {{ usedBy(c) }} {{ usedBy(c) === 1 ? "product" : "products" }}</span></span>
                  <span v-if="confirmCat === c" class="flex flex-wrap items-center gap-2" role="group" :aria-label="`Delete ${c}?`">
                    <span>{{ usedBy(c) > 0 ? `Remove it from ${usedBy(c)} ${usedBy(c) === 1 ? "product" : "products"}?` : "Delete it?" }}</span>
                    <button type="button" class="btn-danger" :disabled="catBusy" @click="deleteCategory(c)"><IconTrash />Yes, delete <span class="sr-only">{{ c }}</span></button>
                    <button type="button" class="btn-secondary" @click="confirmCat = null">Cancel</button>
                  </span>
                  <button v-else type="button" class="btn-secondary" @click="confirmCat = c"><IconTrash />Delete <span class="sr-only">category {{ c }}</span></button>
                </li>
              </ul>
            </div>
          </details>
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="label">Variations <span class="font-normal text-ink-muted">(versions, sizes, colours: optional)</span></legend>
          <p class="hint">If you add variations, shoppers must pick one before they can buy. Leave a price empty to use this product's price. Leave stock empty if you do not count it; 0 means sold out.</p>
          <p v-if="errors.variations" id="p-variations-err" role="alert" class="field-msg"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ errors.variations }}</p>
          <template v-if="form.layers.length === 0">
            <ul v-if="form.variations.length > 0" class="space-y-2">
              <li v-for="(v, i) in form.variations" :key="v.key" class="flex flex-wrap items-end gap-2 rounded-lg border border-brand-sky p-2">
                <div class="min-w-[10rem] flex-1">
                  <label class="label" :for="i === 0 ? 'p-variations' : `p-var-name-${v.key}`">Name <span class="sr-only">of variation {{ i + 1 }}</span></label>
                  <input :id="i === 0 ? 'p-variations' : `p-var-name-${v.key}`" v-model="v.name" class="input" maxlength="60" placeholder="For example Version A">
                </div>
                <div class="w-40">
                  <label class="label" :for="`p-var-price-${v.key}`">Price (PHP) <span class="sr-only">of variation {{ i + 1 }}</span></label>
                  <input :id="`p-var-price-${v.key}`" v-model="v.price" class="input" inputmode="decimal" placeholder="Same as product">
                </div>
                <div class="w-28">
                  <label class="label" :for="`p-var-stock-${v.key}`">Stock <span class="sr-only">of variation {{ i + 1 }}</span></label>
                  <input :id="`p-var-stock-${v.key}`" v-model="v.stock" class="input" inputmode="numeric" placeholder="Not counted">
                </div>
                <button type="button" class="btn-secondary" @click="removeVariation(v)"><IconTrash />Remove <span class="sr-only">variation {{ v.name || i + 1 }}</span></button>
              </li>
            </ul>
            <button type="button" :id="form.variations.length === 0 ? 'p-variations' : undefined" class="btn-secondary" :disabled="form.variations.length >= VARIATIONS_MAX" @click="addVariation"><IconPlus />Add a variation</button>
          </template>
          <div class="space-y-3 rounded-lg border border-brand-sky p-3">
            <h3 class="font-bold">Layers <span class="font-normal text-ink-muted">(for products with combinations, like a phone)</span></h3>
            <p class="hint">Add a layer for each choice, such as Color and Storage, and type its values separated by commas (up to {{ LAYER_VALUES_MAX }}). Shoppers pick one value in each layer, and every combination can have its own price. Once a layer has values, it replaces the simple list above.</p>
            <div v-for="(l, i) in form.layers" :key="l.key" class="flex flex-wrap items-end gap-2">
              <div class="w-40">
                <label class="label" :for="`p-layer-name-${l.key}`">Layer {{ i + 1 }} name</label>
                <input :id="`p-layer-name-${l.key}`" v-model="l.name" class="input" maxlength="30" placeholder="For example Color">
              </div>
              <div class="min-w-[12rem] flex-1">
                <label class="label" :for="`p-layer-values-${l.key}`">Values of layer {{ i + 1 }}</label>
                <input :id="`p-layer-values-${l.key}`" v-model="l.values" class="input" placeholder="Black, White, Gold">
              </div>
              <button type="button" class="btn-secondary" @click="removeLayer(l)"><IconTrash />Remove <span class="sr-only">layer {{ l.name || i + 1 }}</span></button>
            </div>
            <button type="button" class="btn-secondary" :disabled="form.layers.length >= LAYERS_MAX" @click="addLayer"><IconPlus />Add a layer</button>
            <div v-if="comboRows.length > 0">
              <h4 class="mb-1 text-sm font-bold">Combinations ({{ comboRows.length }}, the most is {{ COMBOS_MAX }})</h4>
              <ul class="space-y-1">
                <li v-for="r in comboRows" :key="r.key" class="flex flex-wrap items-center gap-2 rounded-md bg-brand-ivory px-3 py-2 text-sm">
                  <span class="min-w-[10rem] flex-1 font-semibold">{{ r.name }}</span>
                  <label class="flex items-center gap-2"><span class="sr-only">Price of {{ r.name }}, PHP</span>
                    <input class="input w-36" inputmode="decimal" :aria-label="`Price of ${r.name}, PHP`" placeholder="Same as product" :value="comboOf(r.key).price ?? ''" @input="setCombo(r.key, { price: $event.target.value })">
                  </label>
                  <label class="flex items-center gap-2"><span class="sr-only">Stock of {{ r.name }}</span>
                    <input class="input w-28" inputmode="numeric" :aria-label="`Stock of ${r.name}`" placeholder="Not counted" :value="comboOf(r.key).stock ?? ''" @input="setCombo(r.key, { stock: $event.target.value })">
                  </label>
                  <label class="flex min-h-target items-center gap-2"><input type="checkbox" class="check" :checked="comboOf(r.key).active !== false" @change="setCombo(r.key, { active: $event.target.checked })">For sale<span class="sr-only">: {{ r.name }}</span></label>
                </li>
              </ul>
            </div>
          </div>
        </fieldset>

        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="form.pre_order" type="checkbox" class="check">Pre-order</label>
          <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="form.is_new" type="checkbox" class="check">Show the NEW badge</label>
          <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="form.active" type="checkbox" class="check">Visible in the shop</label>
        </div>

        <fieldset class="space-y-3">
          <legend class="label">Image</legend>
          <div class="flex flex-wrap items-start gap-4">
            <div class="aspect-square w-40 overflow-hidden rounded-2xl border border-link bg-brand-ivory">
              <img v-if="shownImage" :src="shownImage" alt="Preview of the product" class="h-full w-full object-cover">
              <div v-else class="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
            </div>
            <div class="min-w-[12rem] flex-1 space-y-2">
              <input id="p-image" type="file" :accept="ACCEPT" class="file-input sr-only" aria-describedby="p-image-hint" @change="onImage">
              <label for="p-image" class="btn-secondary cursor-pointer"><IconUpload />{{ shownImage ? "Replace image" : "Choose image" }}</label>
              <button v-if="file" type="button" class="btn-secondary ml-2" @click="() => { file = null; fileError = ''; }"><IconClose />Undo choice</button>
              <p id="p-image-hint" class="hint">Square works best. JPG, PNG or WebP, up to {{ MAX_IMAGE_BYTES / 1024 / 1024 }} MB.{{ file ? ` Chosen: ${file.name}. It uploads when you save.` : "" }}</p>
              <p v-if="fileError" role="alert" class="flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{{ fileError }}</p>
              <Field id="p-image_alt" v-slot="a" label="Image description" hint="Read aloud by screen readers, for example: Blue album cover with a glowing ring"><input v-bind="a" v-model="form.image_alt" class="input"></Field>
            </div>
          </div>
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="label">Product info <span class="font-normal text-ink-muted">(shown as sections on the product page)</span></legend>
          <div class="space-y-2">
            <p id="p-desc-images-label" class="label">Description images</p>
            <ul v-if="form.info_images.length > 0 || descFiles.length > 0" class="flex flex-wrap gap-3">
              <li v-for="(path, i) in form.info_images" :key="path" class="w-28 space-y-1">
                <img :src="productImageUrl({ image_path: path })" :alt="`Description illustration ${i + 1}`" class="w-full rounded-lg border border-link">
                <button type="button" class="btn-secondary w-full" @click="dropSaved(path)"><IconTrash />Remove<span class="sr-only"> description image {{ i + 1 }}</span></button>
              </li>
              <li v-for="(d, i) in descFiles" :key="d.url" class="w-28 space-y-1">
                <img :src="d.url" :alt="`New description illustration ${i + 1}`" class="w-full rounded-lg border border-link">
                <button type="button" class="btn-secondary w-full" @click="dropDesc(d)"><IconClose />Undo<span class="sr-only"> new description image {{ i + 1 }}</span></button>
              </li>
            </ul>
            <input id="p-desc-images" type="file" multiple :accept="ACCEPT" class="file-input sr-only" aria-describedby="p-desc-images-hint" @change="onDescImages">
            <label for="p-desc-images" class="btn-secondary cursor-pointer"><IconUpload />Add images</label>
            <p id="p-desc-images-hint" class="hint">Shown at the top of the Description, in the order added. Each image keeps its own proportions and is scaled down to fit the page width, never cropped. Up to {{ INFO_IMAGES_MAX }} images; they upload when you save.</p>
          </div>
          <Field v-for="[k, label] in INFO_SECTIONS" :id="`p-${k}`" :key="k" v-slot="a" :label="label" :error="errors[k]" hint="Leave empty to hide this section. Select text and press the B button (or Ctrl/Cmd+B) to make it bold. Line breaks are kept.">
            <BoldTextarea v-bind="a" v-model="form[k]" :rows="4" :max-length="INFO_MAX" />
          </Field>
        </fieldset>

        <div class="sheet-actions flex justify-end gap-2 border-t border-brand-sky">
          <button type="button" class="btn-secondary" @click="close"><IconClose />Cancel</button>
          <button class="btn-primary" :disabled="saving"><IconSave />{{ saving ? "Saving…" : form.id ? "Save product" : "Add product" }}</button>
        </div>
      </form>
    </Modal>
    <ConfirmDialog v-if="deleting" title="Delete this product?" confirm-label="Delete product" @cancel="deleting = null" @confirm="remove">Delete <strong>{{ deleting.title }}</strong> and its image? This cannot be undone. To keep it but hide it from visitors, use Hide instead.</ConfirmDialog>
  </div>
</template>
