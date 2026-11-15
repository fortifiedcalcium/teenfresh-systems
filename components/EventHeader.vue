<script setup>
import { fmtDate, fmtDeadline, fmtTimeRange, mapsUrl } from "~/lib/availability.js";
import { peso } from "~/lib/payment.js";

// The event's key facts as real text (never only inside a poster image).
const props = defineProps({ event: { type: Object, required: true }, st: Object, kits: { type: Array, default: () => [] } });
const fee = computed(() => Number(props.event.registration_fee));
const paid = computed(() => fee.value > 0 || props.kits.length > 0);
</script>

<template>
  <header class="card p-4">
    <h2 class="text-2xl">{{ event.title }}</h2>
    <p v-if="event.subtitle" class="text-ink-muted">{{ event.subtitle }}</p>
    <InfoList class="mt-3 text-ink sm:grid-cols-2 sm:gap-x-6">
      <InfoRow label="Date:"><template #icon><IconCalendar /></template>{{ fmtDate(event.event_date) }}</InfoRow>
      <InfoRow label="Time:"><template #icon><IconClock /></template>{{ fmtTimeRange(event.event_date, event.ends_at) }}</InfoRow>
      <InfoRow label="Venue:" class="sm:col-span-2"><template #icon><IconMapPin /></template>{{ [event.venue, event.venue_address].filter(Boolean).join(", ") }} <a v-if="event.venue || event.venue_address" :href="mapsUrl(event)" target="_blank" rel="noopener noreferrer">Open in Google Maps <span class="sr-only">(opens in a new tab)</span></a></InfoRow>
      <InfoRow v-if="kits.length > 0" label="Kits:" class="sm:col-span-2" :note="event.fee_note ? `Prices are ${event.fee_note}.` : null">
        <template #icon><IconPackage /></template>
        <span class="block"><span v-for="k in kits" :key="k.id" class="block">{{ k.name }}: <NoWrap>{{ peso(k.unit_price) }}</NoWrap></span></span>
      </InfoRow>
      <InfoRow v-else-if="fee > 0" label="Pre-registration fee:"><template #icon><IconWallet /></template><NoWrap>{{ peso(fee) }}</NoWrap>{{ event.fee_note ? ` (${event.fee_note})` : "" }}</InfoRow>
      <InfoRow v-if="paid" label="Mode of payment:"><template #icon><IconWallet /></template>GCash only</InfoRow>
      <InfoRow v-if="event.registration_deadline" label="Registration deadline:"><template #icon><IconLock /></template>{{ fmtDeadline(event.registration_deadline) }}</InfoRow>
      <InfoRow v-if="event.hashtags?.length > 0" label="Hashtags:"><template #icon><IconLink /></template>{{ event.hashtags.join(" ") }}</InfoRow>
    </InfoList>
    <p class="mt-3 flex flex-wrap items-center gap-2">
      <strong v-if="paid" class="text-lg">1 Form = 1 Entry</strong>
      <Badge v-if="st?.canRegister && st.slotsLeft > 0" tone="warn">LIMITED SLOTS ONLY! {{ st.slotsLeft }} left</Badge>
    </p>
    <p class="mt-3 text-sm text-ink-muted">* Indicates required question</p>
  </header>
</template>
