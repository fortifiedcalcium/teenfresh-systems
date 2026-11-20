<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { fetchAll } from "~/lib/api";
import { fmtDateTime } from "~/lib/availability";

const { user } = useAuth();
const toast = useToast();
const rows = ref(null);
const q = ref("");
const role = ref("");

const load = () => fetchAll(() => supabase.from("profiles").select("*").order("created_at").order("id")).then((r) => { rows.value = r; }).catch(() => { rows.value = []; toast("Could not load users", "error"); });
onMounted(load);

async function setRoleFor(u, next) {
  if (!window.confirm(`${next === "admin" ? "Promote" : "Demote"} ${u.email} ${next === "admin" ? "to admin" : "to attendee"}?`)) return;
  const { error } = await supabase.from("profiles").update({ role: next }).eq("id", u.id);
  if (error) toast(error.message, "error"); else { toast("Role updated", "success"); load(); }
}

const shown = computed(() => (rows.value || []).filter((r) => (!role.value || r.role === role.value) && (!q.value || `${r.email} ${r.full_name || ""}`.toLowerCase().includes(q.value.toLowerCase()))));
const cols = [
  { key: "full_name", label: "Name" }, { key: "email", label: "Email" }, { key: "role", label: "Role" }, { key: "created_at", label: "Joined" },
  { key: "actions", label: "", sortable: false },
];
</script>

<template>
  <div class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl font-black"><IconShield />Admin users</h1>
    <AdminSwitch group="settings" />
    <FilterBar :active-count="role ? 1 : 0">
      <template #search><input v-model="q" class="input w-full md:w-72" placeholder="Search name or email" aria-label="Search users"></template>
      <select v-model="role" class="input max-w-[10rem]" aria-label="Role filter"><option value="">All roles</option><option value="admin">Admins</option><option value="attendee">Attendees</option></select>
    </FilterBar>
    <DataTable caption="Admin users" :columns="cols" :rows="shown" :loading="rows === null" empty="No users found.">
      <template #cell-full_name="{ row }">{{ row.full_name || "—" }}</template>
      <template #cell-role="{ row }"><span :class="['badge', row.role === 'admin' ? 'badge-info' : 'badge-neutral']">{{ row.role }}</span></template>
      <template #cell-created_at="{ row }">{{ fmtDateTime(row.created_at) }}</template>
      <template #cell-actions="{ row }">
        <span v-if="row.id === user?.id" class="text-xs text-ink-muted">You</span>
        <button v-else-if="row.role === 'admin'" type="button" class="btn-secondary" @click="setRoleFor(row, 'attendee')"><IconArrowDown />Demote <span class="sr-only">{{ row.email }}</span></button>
        <button v-else type="button" class="btn-secondary" @click="setRoleFor(row, 'admin')"><IconShield />Make admin <span class="sr-only">{{ row.email }}</span></button>
      </template>
    </DataTable>
  </div>
</template>
