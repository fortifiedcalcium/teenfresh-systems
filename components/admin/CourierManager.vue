<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { COURIER_MAX, validateCourierName } from "~/lib/orders";

// Admin: the couriers shoppers and admins can pick from. Orders keep the name they were given, so deleting a courier never changes an old order.
const toast = useToast();
const announce = useAnnounce();
const list = ref(null);
const name = ref("");
const error = ref("");
const confirm = ref(null);       // the courier waiting for "Yes, delete"
const busy = ref(false);

async function load() {
  const { data, error: err } = await supabase.from("couriers").select("id,name").order("id");
  if (err) { toast("Could not load the couriers: " + err.message, "error"); list.value = []; return; }
  list.value = data || [];
}
onMounted(load);

async function add() {
  const problem = validateCourierName(name.value, (list.value || []).map((c) => c.name));
  if (problem) { error.value = problem; announce(problem, "assertive"); return; }
  busy.value = true; error.value = "";
  const { error: err } = await supabase.from("couriers").insert({ name: name.value.trim() });
  busy.value = false;
  if (err) { const m = err.code === "23505" ? "That courier already exists." : err.message; error.value = m; announce(m, "assertive"); return; }
  announce(`Courier ${name.value.trim()} added`);
  name.value = "";
  await load();
}
async function remove(c) {
  busy.value = true; error.value = "";
  const { error: err } = await supabase.from("couriers").delete().eq("id", c.id);
  busy.value = false; confirm.value = null;
  if (err) { error.value = err.message; return; }
  toast(`Courier ${c.name} deleted`, "success");
  await load();
}
</script>

<template>
  <section class="card space-y-3 p-4" aria-labelledby="couriers-h">
    <h2 id="couriers-h" class="flex items-center gap-2 text-lg font-black"><IconPackage />Couriers</h2>
    <p class="text-sm text-ink-muted">Shoppers choose their courier from this list, and you ship with one of them. "Other" (typing any name) is always offered. Deleting a courier does not change orders that already use it.</p>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <InputWithAction id="new-courier" v-model="name" label="New courier" :hint="`Up to ${COURIER_MAX} characters`" input-class="input w-64 max-w-full" :maxlength="COURIER_MAX" @keydown.enter.prevent="add">
      <template #action><button type="button" class="btn-secondary" :disabled="busy" @click="add"><IconPlus />Add courier</button></template>
    </InputWithAction>
    <Loading v-if="list === null" label="Loading couriers…" />
    <p v-else-if="list.length === 0" class="text-sm text-ink-muted">No couriers yet. Shoppers can only type a courier name until you add some.</p>
    <ul v-else class="space-y-1">
      <li v-for="c in list" :key="c.id" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-brand-ivory px-3 py-1 text-sm">
        <span class="font-semibold">{{ c.name }}</span>
        <span v-if="confirm === c.id" class="flex flex-wrap items-center gap-2" role="group" :aria-label="`Delete ${c.name}?`">
          <span>Delete it from the list?</span>
          <button type="button" class="btn-danger" :disabled="busy" @click="remove(c)"><IconTrash />Yes, delete <span class="sr-only">{{ c.name }}</span></button>
          <button type="button" class="btn-secondary" @click="confirm = null">Cancel</button>
        </span>
        <button v-else type="button" class="btn-secondary" @click="confirm = c.id"><IconTrash />Delete <span class="sr-only">courier {{ c.name }}</span></button>
      </li>
    </ul>
  </section>
</template>
