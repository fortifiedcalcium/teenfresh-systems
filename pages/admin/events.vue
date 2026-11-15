<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { fmtDateTime } from "~/lib/availability";
import { peso } from "~/lib/payment";
import { blankEvent, eventToForm, fromLocalInput, cleanTerms, parseLinks } from "~/lib/eventForm";

const { events, reloadEvents } = useAdminContext();
const toast = useToast();
const form = ref<any>(null); // null closed; object = editing (id present) or new
const tab = ref("details");
const saving = ref(false);
const error = ref("");
const deleting = ref(null);
const TABS = [["details", "Details", "IconInfo"], ["kits", "Kits", "IconPackage"], ["media", "Media", "IconImage"]];

function open(e) { form.value = e ? eventToForm(e) : blankEvent(); tab.value = "details"; error.value = ""; }

async function save() {
  error.value = "";
  const f = form.value;
  const cap = parseInt(f.capacity, 10), fee = Number(f.registration_fee || 0);
  if (!f.title.trim() || !f.event_date) { error.value = "Title and start date are required."; return; }
  if (!(cap > 0)) { error.value = "Capacity must be above 0."; return; }
  if (!(fee >= 0)) { error.value = "The registration fee cannot be negative."; return; }
  if (!/^[A-Z0-9]{2,12}$/.test(f.ticket_prefix)) { error.value = "Ticket prefix: 2 to 12 capital letters or numbers."; return; }
  if (f.ends_at && new Date(f.ends_at) < new Date(f.event_date)) { error.value = "The end time is before the start time."; return; }
  if (f.registration_deadline && new Date(f.registration_deadline) > new Date(f.event_date)) { error.value = "The registration deadline is after the event starts."; return; }
  const parsed = parseLinks(f.contact_links);
  if (parsed.error) { error.value = parsed.error; return; }
  const days = f.receipt_retention_days === "" ? null : parseInt(f.receipt_retention_days, 10);
  if (days !== null && !(days >= 0)) { error.value = "Receipt retention must be 0 or more days."; return; }

  saving.value = true;
  const row: Record<string, any> = {
    title: f.title.trim(), subtitle: f.subtitle.trim() || null, tagline: f.tagline.trim() || null, description: f.description.trim() || null,
    venue: f.venue.trim() || null, venue_address: f.venue_address.trim() || null,
    event_date: fromLocalInput(f.event_date), ends_at: fromLocalInput(f.ends_at), registration_deadline: fromLocalInput(f.registration_deadline),
    capacity: cap, ticket_prefix: f.ticket_prefix, registration_fee: fee, fee_note: f.fee_note.trim() || null,
    price_info: fee > 0 ? `${peso(fee)}${f.fee_note.trim() ? ` ${f.fee_note.trim()}` : ""}` : null,
    hashtags: f.hashtags.split(/[\s,]+/).filter(Boolean), kit_inclusions: f.kit_inclusions.split("\n").map((s) => s.trim()).filter(Boolean),
    payment_account_name: f.payment_account_name.trim() || null, payment_account_number: f.payment_account_number.trim() || null,
    contact_links: parsed.links, registration_open: f.registration_open, send_ack_email: f.send_ack_email,
    receipt_retention_days: days, terms_html: cleanTerms(f.terms_html),
  };
  if (f.slug.trim()) row.slug = f.slug.trim();   // blank keeps the current address (or makes one from the title for a new event)
  const { data, error: err } = f.id ? await supabase.from("events").update(row).eq("id", f.id).select().single() : await supabase.from("events").insert(row).select().single();
  saving.value = false;
  if (err) { error.value = err.message; return; }
  toast("Event saved", "success");
  reloadEvents();
  form.value = eventToForm(data);
  if (!f.id) tab.value = "kits";   // a new event goes straight to its kits and images
}
async function toggleOpen(e) {
  const { error: err } = await supabase.from("events").update({ registration_open: !e.registration_open }).eq("id", e.id);
  if (err) toast(err.message, "error"); else reloadEvents();
}
async function remove() {
  const { error: err } = await supabase.from("events").delete().eq("id", deleting.value.id);
  if (err) toast(err.message, "error"); else { toast("Event deleted", "success"); reloadEvents(); }
  deleting.value = null;
}
const current = computed(() => (form.value?.id ? events.value.find((e) => e.id === form.value.id) : null));
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between"><h1 class="flex items-center gap-2 text-2xl"><IconCalendar />Events</h1><button type="button" class="btn-primary" @click="open(null)"><IconPlus />New event</button></div>
    <Empty v-if="events.length === 0">No events yet.</Empty>
    <ul v-else class="space-y-3">
      <li v-for="e in events" :key="e.id" class="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 class="font-black">{{ e.title }}</h2>
          <p class="text-sm text-ink-muted">{{ fmtDateTime(e.event_date) }} · {{ e.venue || "No venue" }} · capacity {{ e.capacity }} · {{ Number(e.registration_fee) > 0 ? peso(e.registration_fee) : "free" }}</p>
          <p v-if="e.registration_deadline" class="text-sm text-ink-muted">Registration closes {{ fmtDateTime(e.registration_deadline) }}</p>
          <span :class="['badge mt-1', e.registration_open ? 'badge-ok' : 'badge-bad']">{{ e.registration_open ? "Registration open" : "Registration closed" }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secondary" @click="toggleOpen(e)"><IconLock v-if="e.registration_open" /><IconUnlock v-else />{{ e.registration_open ? "Close registration" : "Open registration" }} <span class="sr-only">for {{ e.title }}</span></button>
          <button type="button" class="btn-secondary" @click="open(e)"><IconPencil />Edit <span class="sr-only">{{ e.title }}</span></button>
          <button type="button" class="btn-danger" @click="deleting = e"><IconTrash />Delete <span class="sr-only">{{ e.title }}</span></button>
        </div>
      </li>
    </ul>

    <Modal v-if="form" :title="form.id ? 'Edit event' : 'New event'" wide @close="form = null">
      <div role="tablist" aria-label="Event sections" class="mb-4 flex gap-2">
        <button v-for="[k, l, i] in TABS" :id="`tab-${k}`" :key="k" type="button" role="tab" :aria-selected="tab === k" :aria-controls="`panel-${k}`" :class="tab === k ? 'btn-primary' : 'btn-secondary'" :disabled="k !== 'details' && !form.id" @click="tab = k"><component :is="i" />{{ l }}</button>
        <p v-if="!form.id" class="self-center text-sm text-ink-muted">Save the event first to add kits and images.</p>
      </div>

      <div v-if="tab === 'details'" id="panel-details" role="tabpanel" aria-labelledby="tab-details">
        <form class="space-y-5" novalidate @submit.prevent="save">
          <Alert v-if="error" tone="bad">{{ error }}</Alert>
          <fieldset class="space-y-4"><legend class="text-lg font-black">Basics</legend>
            <Field id="title" v-slot="a" label="Title" required><input v-bind="a" v-model="form.title" class="input"></Field>
            <Field id="slug" v-slot="a" label="Web address" :hint="`Appears as /events/${form.slug.trim() || 'your-event'}. Letters, numbers and dashes are kept; the old address keeps working.`"><input v-bind="a" v-model="form.slug" class="input" maxlength="120" autocapitalize="none" spellcheck="false" placeholder="Made from the title when left empty"></Field>
            <Field id="subtitle" v-slot="a" label="Subtitle"><input v-bind="a" v-model="form.subtitle" class="input"></Field>
            <Field id="tagline" v-slot="a" label="Home page headline" hint="The big line on the home page. Falls back to the subtitle, then the title."><input v-bind="a" v-model="form.tagline" class="input" maxlength="120"></Field>
            <Field id="description" v-slot="a" label="Description"><textarea v-bind="a" v-model="form.description" class="input" rows="2" /></Field>
            <div class="grid gap-4 md:grid-cols-2">
              <Field id="venue" v-slot="a" label="Venue"><input v-bind="a" v-model="form.venue" class="input"></Field>
              <Field id="venue_address" v-slot="a" label="Address" hint="Used for the Open in Google Maps link"><input v-bind="a" v-model="form.venue_address" class="input"></Field>
              <Field id="date" v-slot="a" label="Start (Manila time shown to attendees)" required><input v-bind="a" v-model="form.event_date" type="datetime-local" class="input"></Field>
              <Field id="ends_at" v-slot="a" label="End"><input v-bind="a" v-model="form.ends_at" type="datetime-local" class="input"></Field>
              <Field id="deadline" v-slot="a" label="Registration deadline" hint="Empty = until the event starts"><input v-bind="a" v-model="form.registration_deadline" type="datetime-local" class="input"></Field>
              <Field id="capacity" v-slot="a" label="Capacity" required hint="Pending forms count toward capacity"><input v-bind="a" v-model="form.capacity" type="number" min="1" class="input"></Field>
              <Field id="prefix" v-slot="a" label="Ticket prefix" hint="IVEMONOP gives IVEMONOP-000123"><input v-bind="a" :value="form.ticket_prefix" class="input font-mono uppercase" @input="form.ticket_prefix = ($event.target as HTMLInputElement).value.toUpperCase()"></Field>
            </div>
            <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="form.registration_open" type="checkbox" class="check"> Registration open</label>
            <Field id="hashtags" v-slot="a" label="Hashtags" hint="Separated by spaces, for example #IVEMON_OP #Teenfresh"><input v-bind="a" v-model="form.hashtags" class="input"></Field>
            <Field id="kit" v-slot="a" label="Kit inclusions" hint="One per line, for example (1) Cupsleeve"><textarea v-bind="a" v-model="form.kit_inclusions" class="input" rows="3" /></Field>
          </fieldset>

          <fieldset class="space-y-4"><legend class="text-lg font-black">Fee and payment (GCash)</legend>
            <div class="grid gap-4 md:grid-cols-2">
              <Field id="fee" v-slot="a" label="Registration fee (PHP)" hint="Used only when the event has no kits (see the Kits tab). 0 = free event: no payment step, tickets are issued immediately"><input v-bind="a" v-model="form.registration_fee" type="number" min="0" step="0.01" class="input"></Field>
              <Field id="fee_note" v-slot="a" label="Fee note" hint="Shown after the fee, for example: exclusive of food and drinks"><input v-bind="a" v-model="form.fee_note" class="input"></Field>
              <Field id="pay_name" v-slot="a" label="GCash account name (masked)" hint="Store it already masked, for example BR**N CA**O S."><input v-bind="a" v-model="form.payment_account_name" class="input"></Field>
              <Field id="pay_number" v-slot="a" label="GCash number"><input v-bind="a" v-model="form.payment_account_number" class="input" inputmode="numeric"></Field>
            </div>
            <p class="text-sm text-ink-muted">The GCash number is shown to every visitor of the registration form, like on a public form.</p>
          </fieldset>

          <fieldset class="space-y-4"><legend class="text-lg font-black">Terms and contact</legend>
            <Field id="terms_html" label="Terms and Conditions" hint="Format it with the buttons, no HTML needed. Shown on the form and merged into the confirmation email as {{Terms}}"><TermsEditor id="terms_html" v-model="form.terms_html" /></Field>
            <Field id="contact" v-slot="a" label="Contact links" hint="One per line: Label | URL. Facebook, X, Instagram, TikTok, Gmail (mailto:you@example.com)"><textarea v-bind="a" v-model="form.contact_links" class="input font-mono text-sm" rows="5" /></Field>
          </fieldset>

          <fieldset class="space-y-3"><legend class="text-lg font-black">Emails and privacy</legend>
            <label class="flex min-h-target items-center gap-3 text-sm"><input v-model="form.send_ack_email" type="checkbox" class="check"> Send a "We received your registration" email right after someone submits (off by default)</label>
            <Field id="retention" v-slot="a" label="Delete payment receipts this many days after the event" hint="Empty = keep them. Run scripts/purge-receipts.mjs (see the README) to carry it out."><input v-bind="a" v-model="form.receipt_retention_days" type="number" min="0" class="input"></Field>
          </fieldset>

          <div class="sheet-actions flex justify-end gap-2 border-t border-brand-sky"><button type="button" class="btn-secondary" @click="form = null"><IconClose />Close</button><button class="btn-primary" :disabled="saving"><IconSave />{{ saving ? "Saving…" : "Save event" }}</button></div>
        </form>
      </div>
      <div v-if="tab === 'kits' && current" id="panel-kits" role="tabpanel" aria-labelledby="tab-kits"><KitsTab :event="current" /></div>
      <div v-if="tab === 'media' && current" id="panel-media" role="tabpanel" aria-labelledby="tab-media"><MediaTab :event="current" @event-changed="reloadEvents" /></div>
    </Modal>
    <ConfirmDialog v-if="deleting" title="Delete this event?" confirm-label="Delete event" @cancel="deleting = null" @confirm="remove">Delete <strong>{{ deleting.title }}</strong> and ALL its registrations, payments and images? This cannot be undone. Receipt files in storage are not removed automatically.</ConfirmDialog>
  </div>
</template>
