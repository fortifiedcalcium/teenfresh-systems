<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { fmtDateTime } from "~/lib/availability";
import { AREAS, VERBS, describe } from "~/lib/changeLog";

const toast = useToast();
const rows = ref(null);
const failed = ref(false);
const area = ref("");
const q = ref("");

onMounted(() => {
  supabase.from("change_log").select("*").order("at", { ascending: false }).order("id", { ascending: false }).limit(1000)
    .then(({ data, error }) => {
      if (error) { failed.value = true; rows.value = []; toast("Could not load the change log", "error"); } else rows.value = data || [];
    });
});

const shown = computed(() => (rows.value || []).filter((r) => (!area.value || r.table_name === area.value)
  && (!q.value || `${r.label || ""} ${r.actor_email || ""} ${describe(r)}`.toLowerCase().includes(q.value.toLowerCase()))));
const cols = [
  { key: "at", label: "When" }, { key: "actor_email", label: "Who" }, { key: "table_name", label: "Area" }, { key: "action", label: "Action" },
  { key: "label", label: "Item" }, { key: "changes", label: "What changed", sortable: false, className: "max-w-md break-words whitespace-normal" },
];
</script>

<template>
  <div class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl font-black"><IconHistory />Change log</h1>
    <p class="text-sm text-ink-muted">Who changed what across the whole system, events and shop, newest first (the latest 1,000 changes). Names, addresses, contact details and payment references are recorded as “changed” without their values. Entries cannot be edited or deleted.</p>
    <Alert v-if="failed" tone="bad"><strong>The change log is not set up yet.</strong> Run <code>004_change_log.sql</code> and then <code>025_universal_change_log.sql</code> in the Supabase SQL Editor for this project, then reload.</Alert>
    <FilterBar :active-count="area ? 1 : 0">
      <template #search><input v-model="q" class="input w-full md:w-72" placeholder="Search item, person or change" aria-label="Search the change log"></template>
      <select v-model="area" class="input max-w-[12rem]" aria-label="Area filter">
        <option value="">All areas</option>
        <option v-for="(v, k) in AREAS" :key="k" :value="k">{{ v }}</option>
      </select>
    </FilterBar>
    <DataTable caption="Change log" :columns="cols" :rows="shown" row-key="id" :loading="rows === null" empty="No changes recorded yet." :initial-sort="{ key: 'at', dir: 'desc' }">
      <template #cell-at="{ row }">{{ fmtDateTime(row.at) }}</template>
      <template #cell-actor_email="{ row }">{{ row.actor_email || "System / SQL editor" }}</template>
      <template #cell-table_name="{ row }">{{ AREAS[row.table_name] || row.table_name }}</template>
      <template #cell-action="{ row }"><span :class="['badge', row.action === 'delete' ? 'badge-bad' : row.action === 'insert' ? 'badge-ok' : 'badge-info']">{{ VERBS[row.action] }}</span></template>
      <template #cell-label="{ row }">{{ row.label || "—" }}</template>
      <template #cell-changes="{ row }">{{ describe(row) }}</template>
    </DataTable>
  </div>
</template>
