<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { kitLabel, peso } from "~/lib/payment";
import { fmtDateTime } from "~/lib/availability";

definePageMeta({ middleware: ["auth"] });
const STATUS = {
  pending_verification: { tone: "warn", label: "Pending verification" },
  confirmed: { tone: "ok", label: "Confirmed" },
  rejected: { tone: "bad", label: "Rejected" },
  cancelled: { tone: "bad", label: "Cancelled" },
};
const { user } = useAuth();
const rows = ref(null);
const error = ref("");
const resubmit = ref(null);
const banners = ref({});

async function load() {
  const { data, error: e } = await supabase.from("registrations")
    .select("*, events(title,event_date,venue,registration_fee,banner_coming_soon), payments(id,status,review_note,amount_due,amount_paid,reference_number,sender_name)")
    // "My" registrations: ask for my own rows explicitly. The database already hides other people's rows from attendees, but
    // admins are allowed to read everything, so without this filter an admin saw every user's registrations on this page.
    .eq("user_id", user.value.id)
    .order("created_at", { ascending: false });
  if (e) error.value = "Could not load your registrations.";
  const im = await supabase.from("event_images").select("*").eq("slot", "banner");          // the same banners the home page shows
  banners.value = Object.fromEntries((im.data || []).map((x) => [x.event_id, x]));
  const list = data || [];
  // how many of my forms share each payment (the resubmit minimum is fee x forms)
  const count = {}, sum = {};
  list.forEach((r) => { if (r.payment_id && r.status !== "cancelled") { count[r.payment_id] = (count[r.payment_id] || 0) + 1; sum[r.payment_id] = Math.round(((sum[r.payment_id] || 0) + Number(r.total_amount || 0)) * 100) / 100; } });
  rows.value = list.map((r) => ({ ...r, formsOnPayment: count[r.payment_id] || 1, payTotal: sum[r.payment_id] || 0 }));
}
onMounted(load);

const needsAction = (r) => r.payments && (r.payments.status === "underpaid" || r.payments.status === "rejected");
// what kind of ticket this is: it decides the stub (confirmed: number + View ticket; pending: waiting; needs action: message + button)
const kindOf = (r) => (r.status === "cancelled" ? "cancelled" : needsAction(r) ? (r.status === "rejected" ? "rejected" : "attention") : r.status === "confirmed" ? "confirmed" : "pending");
function done() { resubmit.value = null; load(); }
</script>

<template>
  <Loading v-if="rows === null" label="Loading your registrations…" class="p-12" logo />
  <div v-else>
    <h1 class="mb-4 flex items-center gap-2 text-2xl"><IconTicket />My registrations</h1>
    <Alert v-if="error" tone="bad" class="mb-3">{{ error }}</Alert>
    <Empty v-if="rows.length === 0">You haven't registered for any event yet. <NuxtLink to="/">Browse events</NuxtLink></Empty>
    <ul v-else class="ticket-grid pb-[env(safe-area-inset-bottom)]">
      <li v-for="r in rows" :key="r.id" class="ticket-li">
        <Ticket :status="kindOf(r)" :labelled-by="`reg-title-${r.id}`">
          <template #image><EventImage slot-key="banner" :event="{ id: r.event_id, title: r.events?.title, banner_coming_soon: r.events?.banner_coming_soon }" :image="banners[r.event_id]" :lightbox="false" read-only class="!rounded-none !border-0" /></template>
          <template #badge><Badge :tone="STATUS[r.status].tone">{{ STATUS[r.status].label }}</Badge></template>
          <template #stub>
            <TicketStub v-if="kindOf(r) === 'confirmed'" label="Ticket no.">
              <div v-if="r.ticket_number" class="ticket__number-row">
                <p class="ticket__number">{{ r.ticket_number }}</p>
                <CopyButton icon-only :text="r.ticket_number" label="Copy ticket number" what="Ticket number" />
              </div>
              <TicketBarcode :value="r.ticket_number || r.id" />
              <TicketAction><NuxtLink class="btn-primary w-full" :to="`/my-ticket/${r.id}`" :aria-label="`View ticket ${r.ticket_number} for ${r.events?.title}`"><IconTicket />View ticket</NuxtLink></TicketAction>
            </TicketStub>
            <TicketStub v-else-if="kindOf(r) === 'pending'" label="Awaiting payment check">
              <p class="text-sm text-ink">Your payment is being verified. A confirmation email will be sent within 48 to 72 hours.</p>
            </TicketStub>
            <TicketStub v-else-if="kindOf(r) === 'cancelled'" label="Cancelled">
              <p class="text-sm text-ink">This registration was cancelled. There is nothing more to do.</p>
            </TicketStub>
            <TicketStub v-else label="Action needed">
              <Alert :tone="r.payments.status === 'underpaid' ? 'warn' : 'bad'" class="border-l-4">
                <p class="font-semibold">{{ r.payments.status === "underpaid" ? `Payment incomplete: ${peso(r.payments.amount_due)} still due.` : "Payment rejected." }}</p>
                <p v-if="r.payments.review_note">{{ r.payments.review_note }}</p>
              </Alert>
              <TicketAction><button type="button" class="btn-primary w-full" @click="resubmit = r"><IconUpload />{{ r.payments.status === "underpaid" ? "Send the missing amount" : "Upload a new receipt" }} <span class="sr-only">for {{ r.name }}</span></button></TicketAction>
            </TicketStub>
          </template>
          <h2 :id="`reg-title-${r.id}`" class="ticket__title">{{ r.events?.title }}</h2>
          <InfoList class="ticket__details">
            <InfoRow label="Date:"><template #icon><IconCalendar /></template>{{ fmtDateTime(r.events?.event_date) }}</InfoRow>
            <InfoRow v-if="r.events?.venue" label="Venue:"><template #icon><IconMapPin /></template>{{ r.events.venue }}</InfoRow>
            <InfoRow label="For:"><template #icon><IconUser /></template><span class="text-ink">{{ r.name }} <NoWrap>(@{{ r.x_username }})</NoWrap></span></InfoRow>
            <InfoRow v-if="r.kit_name" label="Kit:"><template #icon><IconPackage /></template>{{ `${kitLabel(r.kit_name, r.kit_quantity)}${Number(r.total_amount) > 0 ? ` · ${peso(r.total_amount)}` : ""}` }}</InfoRow>
          </InfoList>
        </Ticket>
      </li>
    </ul>
    <ResubmitDialog v-if="resubmit" :reg="resubmit" @close="resubmit = null" @done="done" />
  </div>
</template>
