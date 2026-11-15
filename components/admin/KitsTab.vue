<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { peso } from "~/lib/payment";
import { validateKit } from "~/lib/kits";

// Admin: the kit options of an event. Each has a name and a price per kit (one kit per form).
const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const toast = useToast();
const blank = () => ({ key: crypto.randomUUID(), id: null, name: "", description: "", unit_price: "", active: true });
const toRow = (k) => ({ key: k.id, id: k.id, name: k.name, description: k.description || "", unit_price: String(k.unit_price), active: k.active });
const rows = ref(null);
const removed = ref([]);
const errors = ref<Record<string, any>>({});     // row key -> { field: message }
const saving = ref(false);
const [focusSignal, bumpFocus] = useErrorFocus();

async function load() {
  const { data, error } = await supabase.from("event_kits").select("*").eq("event_id", props.event.id).order("sort_order").order("created_at");
  if (error) { toast("Could not load the kits: " + error.message, "error"); rows.value = []; return; }
  rows.value = (data || []).map(toRow); removed.value = []; errors.value = {};
}
watch(() => props.event.id, load, { immediate: true });

function remove(r) { rows.value = rows.value.filter((x) => x.key !== r.key); if (r.id) removed.value = [...removed.value, r.id]; }
async function save() {
  const errs = Object.fromEntries(rows.value.map((r) => [r.key, validateKit(r)]).filter(([, e]) => Object.keys(e).length));
  errors.value = errs;
  if (Object.keys(errs).length) { bumpFocus(); return; }
  saving.value = true;
  try {
    if (removed.value.length) { const { error } = await supabase.from("event_kits").delete().in("id", removed.value); if (error) throw error; }
    for (const [i, r] of rows.value.entries()) {
      const row = { event_id: props.event.id, name: r.name.trim(), description: r.description.trim() || null, unit_price: Number(r.unit_price), max_per_order: 1, active: r.active, sort_order: i };
      const { error } = r.id ? await supabase.from("event_kits").update(row).eq("id", r.id) : await supabase.from("event_kits").insert(row);
      if (error) throw error;
    }
    toast("Kits saved", "success");
    await load();
  } catch (e) { toast(e.message || "Could not save the kits", "error"); }
  finally { saving.value = false; }
}
const summaryErrors = computed(() => Object.fromEntries((rows.value || []).flatMap((r, i) => Object.entries(errors.value[r.key] || {}).map(([f, message]) => [`kit${i}-${f}`, `Kit ${Number(i) + 1}: ${message}`]))));
const fid = (i, name) => `kit${i}-${name}`;
const hintFor = (r, e) => (r.unit_price && !e.unit_price && Number(r.unit_price) > 0 ? `${peso(r.unit_price)} each` : "Amount per kit, for example 100");
</script>

<template>
  <Loading v-if="!rows" label="Loading kits…" />
  <div v-else class="space-y-4">
    <p class="text-sm text-ink-muted">Add the kits people can order. Each form picks <strong>one kit</strong> and pays that kit’s price. With no kits, the event uses its single registration fee. Orders already placed keep the price they were placed at, so changing a price only affects new orders. A switched-off kit disappears from the form but stays on old orders.</p>
    <ErrorSummary :errors="summaryErrors" :focus-signal="focusSignal" />
    <Alert v-if="rows.length === 0" tone="info">No kits yet. Add one, or leave it empty to use the flat registration fee.</Alert>
    <ul class="space-y-4">
      <li v-for="(r, i) in rows" :key="r.key">
        <fieldset class="card space-y-3 p-4">
          <legend class="px-1 text-lg font-black">Kit {{ Number(i) + 1 }}{{ r.name ? `: ${r.name}` : "" }}</legend>
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <label :for="fid(i, 'name')" class="label">Name (required)</label>
              <input :id="fid(i, 'name')" v-model="r.name" class="input" maxlength="80" :aria-invalid="errors[r.key]?.name ? 'true' : undefined" :aria-describedby="errors[r.key]?.name ? `${fid(i, 'name')}-err` : undefined">
              <p v-if="errors[r.key]?.name" :id="`${fid(i, 'name')}-err`" class="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{{ errors[r.key].name }}</p>
            </div>
            <div>
              <label :for="fid(i, 'unit_price')" class="label">Price per kit, PHP (required)</label>
              <input :id="fid(i, 'unit_price')" v-model="r.unit_price" class="input" inputmode="decimal" :aria-invalid="errors[r.key]?.unit_price ? 'true' : undefined" :aria-describedby="errors[r.key]?.unit_price ? `${fid(i, 'unit_price')}-err` : `${fid(i, 'unit_price')}-hint`">
              <p v-if="!errors[r.key]?.unit_price" :id="`${fid(i, 'unit_price')}-hint`" class="hint">{{ hintFor(r, errors[r.key] || {}) }}</p>
              <p v-else :id="`${fid(i, 'unit_price')}-err`" class="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{{ errors[r.key].unit_price }}</p>
            </div>
          </div>
          <div>
            <label :for="fid(i, 'description')" class="label">Description</label>
            <textarea :id="fid(i, 'description')" v-model="r.description" class="input" rows="2" />
            <p class="hint">What is in the kit, for example (1) Cupsleeve, (1) Trading Card</p>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="r.active" type="checkbox" class="check"> Available on the registration form</label>
            <button type="button" class="btn-secondary" @click="remove(r)"><IconTrash />Remove <span class="sr-only">kit {{ Number(i) + 1 }}{{ r.name ? `, ${r.name}` : "" }}</span></button>
          </div>
        </fieldset>
      </li>
    </ul>
    <div class="sheet-actions flex flex-wrap justify-between gap-2 border-t border-brand-sky">
      <button type="button" class="btn-secondary" @click="rows = [...rows, blank()]"><IconPlus />Add a kit</button>
      <button type="button" class="btn-primary" :disabled="saving" @click="save"><IconSave />{{ saving ? "Saving…" : "Save kits" }}</button>
    </div>
  </div>
</template>
