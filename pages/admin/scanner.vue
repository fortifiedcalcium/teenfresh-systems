<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { friendlyError } from "~/lib/api";
import { feedback } from "~/lib/beep";
import { fmtDateTime } from "~/lib/availability";
import { kitLabel } from "~/lib/payment";

// Result panels: surface colour + icon + big text. Sound and vibration are extras, never the only cue (1.4.1).
const PANEL = {
  success: { cls: "bg-brand-mint text-success border-success", icon: "✓", title: "Valid ticket" },
  duplicate: { cls: "bg-brand-cream text-warning-ink border-warning-ink", icon: "!", title: "Already checked in" },
  invalid: { cls: "bg-brand-blush text-danger border-danger", icon: "✕", title: "Invalid ticket" },
};
const REASON = {
  cancelled: "This registration was cancelled.",
  rejected: "This registration was rejected.",
  pending_verification: "This registration is still waiting for payment verification, so it has no valid ticket.",
  not_found: "Ticket not found.",
};
const summary = (r) => {
  if (!r) return "";
  const kit = r.kit_name ? ` Kit: ${r.kit_name}${r.kit_quantity > 1 ? `, quantity ${r.kit_quantity}` : ""}.` : "";
  const who = r.name ? `${r.name}, X username ${r.x_username}, ticket ${r.ticket_number}.${kit}` : `Ticket ${r.ticket_number}.`;
  if (r.result === "success") return `Valid ticket. ${who} Checked in.`;
  if (r.result === "duplicate") return `Already checked in. ${who} First scanned ${fmtDateTime(r.checked_in_at)}${r.checked_in_by_name ? ` by ${r.checked_in_by_name}` : ""}.`;
  return `Invalid ticket. ${r.message || REASON[r.reason] || REASON.not_found} ${r.ticket_number || ""}`;
};

const { event } = useAdminContext();
const result = ref(null);
const busy = ref(false);
const manual = ref("");
const query = ref("");
const matches = ref(null);
const flags = ref({ kit: false, receipt: false });
const sound = ref(true);
onMounted(() => { try { sound.value = localStorage.getItem("scan_sound") !== "off"; } catch { /* ignore */ } });
let busyNow = false;

function toggleSound() { sound.value = !sound.value; try { localStorage.setItem("scan_sound", sound.value ? "on" : "off"); } catch { /* ignore */ } }

async function checkIn(ticket) {
  if (busyNow || !ticket.trim()) return;
  busyNow = true; busy.value = true;
  const { data, error } = await supabase.rpc("check_in_attendee", { p_ticket: ticket.trim() });
  busyNow = false; busy.value = false;
  const r = error ? { result: "invalid", reason: "error", message: friendlyError(error), ticket_number: ticket } : data;
  result.value = r;
  if (!error) flags.value = { kit: !!data.kit_claimed, receipt: !!data.receipt_verified };
  if (sound.value) feedback(r.result);
}
async function updateFlag(key, value) {
  flags.value = { ...flags.value, [key]: value };
  await supabase.from("registrations").update(key === "kit" ? { kit_claimed: value } : { receipt_verified: value }).eq("id", result.value.registration_id);
}
async function search() {
  const q = query.value.trim().replace(/[%,()]/g, " ");
  if (!q) return;
  let req = supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,status").eq("status", "confirmed")
    .or(`name.ilike.%${q}%,x_username.ilike.%${q.replace(/^@/, "")}%,ticket_number.ilike.%${q}%`).order("name").limit(15);
  if (event.value) req = req.eq("event_id", event.value.id);
  const { data } = await req;
  matches.value = data || [];
}
const submitManual = () => { checkIn(manual.value); manual.value = ""; };
const p = computed(() => result.value && PANEL[result.value.result]);
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <h1 class="flex items-center gap-2 text-2xl"><IconScan />QR Scanner</h1>
    <AdminSwitch group="attendees" />

    <section aria-labelledby="scan-h" class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="scan-h" class="text-lg">Scan a ticket</h2>
        <button type="button" class="btn-secondary" :aria-pressed="sound" @click="toggleSound"><IconVolume />Sound and vibration: {{ sound ? "on" : "off" }}</button>
      </div>
      <QrScanner :paused="busy" @scan="checkIn" />
    </section>

    <!-- One assertive live region: every scan result is announced with name, X username, ticket and status. -->
    <div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{{ busy ? "Checking ticket" : summary(result) }}</div>
    <p v-if="busy" class="text-center text-ink-muted" aria-hidden="true">Checking…</p>
    <section v-if="p" aria-label="Scan result" :class="['result-sheet rounded-2xl border-4 p-6 text-center', p.cls]">
      <p class="text-5xl font-extrabold" aria-hidden="true">{{ p.icon }}</p>
      <h2 class="mt-1 text-3xl font-black" style="color: inherit">{{ p.title }}</h2>
      <p v-if="result.result === 'invalid'" class="mt-2 text-lg">{{ result.message || REASON[result.reason] || REASON.not_found }}<br><span class="font-mono text-base">{{ result.ticket_number }}</span></p>
      <div v-else class="mt-3 space-y-1">
        <p class="text-3xl font-extrabold">{{ result.name }}</p>
        <p class="text-xl">@{{ result.x_username }}</p>
        <p class="font-mono text-lg">{{ result.ticket_number }}</p>
        <p v-if="result.kit_name" class="text-xl font-bold">Kit: {{ kitLabel(result.kit_name, result.kit_quantity) }}</p>
        <p v-if="result.result === 'duplicate'" class="mt-2 text-lg font-bold">First scanned {{ fmtDateTime(result.checked_in_at) }}{{ result.checked_in_by_name ? ` by ${result.checked_in_by_name}` : "" }}</p>
        <fieldset class="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-x-6 rounded-xl border-2 border-current bg-white p-3 text-left text-base text-ink">
          <legend class="px-2 text-sm font-black">After check-in</legend>
          <label class="flex min-h-target items-center gap-2"><input type="checkbox" class="check" :checked="flags.receipt" @change="updateFlag('receipt', ($event.target as HTMLInputElement).checked)"> Receipt verified (₱200 or more)</label>
          <label class="flex min-h-target items-center gap-2"><input type="checkbox" class="check" :checked="flags.kit" @change="updateFlag('kit', ($event.target as HTMLInputElement).checked)"> Kit claimed</label>
        </fieldset>
      </div>
      <button type="button" class="btn-secondary mt-4" @click="result = null"><IconClose />Dismiss result</button>
    </section>

    <!-- An equal alternative to the camera, not a hidden fallback -->
    <section id="manual-checkin" tabindex="-1" aria-labelledby="manual-h" class="card space-y-4 p-4">
      <h2 id="manual-h" class="text-lg">Manual check-in</h2>
      <form class="flex flex-wrap gap-2" @submit.prevent="submitManual">
        <div class="min-w-0 flex-1"><label for="ticket-input" class="label">Ticket number</label><input id="ticket-input" v-model="manual" class="input font-mono uppercase" placeholder="IVEMON-000123" autocomplete="off"></div>
        <button class="btn-primary self-end" :disabled="busy || !manual.trim()"><IconUserCheck />Check in</button>
      </form>
      <form class="flex flex-wrap gap-2" @submit.prevent="search">
        <div class="min-w-0 flex-1"><label for="search-input" class="label">Search by name, X username or ticket</label><input id="search-input" v-model="query" class="input" autocomplete="off"></div>
        <button class="btn-secondary self-end"><IconSearch />Search</button>
      </form>
      <template v-if="matches">
        <p v-if="matches.length === 0" role="status" class="text-ink-muted">No matches.</p>
        <ul v-else class="divide-y divide-brand-sky" aria-label="Search results">
          <li v-for="m in matches" :key="m.id" class="flex items-center justify-between gap-3 py-2 text-sm">
            <div><p class="font-semibold">{{ m.name }} <span class="font-normal text-ink-muted">@{{ m.x_username }}</span></p><p class="font-mono text-xs text-ink-muted">{{ m.ticket_number }}{{ m.checked_in_at ? " · already checked in" : "" }}</p></div>
            <button type="button" class="btn-primary" :disabled="busy" @click="checkIn(m.ticket_number)"><IconUserCheck />Check in <span class="sr-only">{{ m.name }}</span></button>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
