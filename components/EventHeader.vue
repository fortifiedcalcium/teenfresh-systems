<script setup lang="ts">
import type { PropType } from "vue";
import { fmtDate, fmtDeadline, fmtTimeRange, mapsUrl } from "~/lib/availability";
import { peso } from "~/lib/payment";

// The event's key facts as real text (never only inside a poster image).
// `slotsSticker` is off on the event page, which already shows the slot count as a badge on the poster and again in its own Slots section:
// the sticker there would be a third copy of the same number. The register page has neither, so it keeps the sticker (the default).
const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true }, st: Object as PropType<Record<string, any>>, kits: { type: Array as PropType<any[]> as PropType<any[]>, default: () => [] }, asH1: Boolean, requiredNote: { type: Boolean, default: true }, slotsSticker: { type: Boolean, default: true } });
const fee = computed(() => Number(props.event.registration_fee));
const paid = computed(() => fee.value > 0 || props.kits.length > 0);
</script>

<template>
  <header class="evt-head">
    <component :is="asH1 ? 'h1' : 'h2'" class="evt-head__title">{{ event.title }}</component>
    <p v-if="event.subtitle" class="evt-head__lead">{{ event.subtitle }}</p>

    <ul class="hero2__stickers" aria-label="Event facts">
      <li class="sticker bg-brand-mint"><IconCalendar />{{ fmtDate(event.event_date) }}</li>
      <li class="sticker bg-brand-sky"><IconClock />{{ fmtTimeRange(event.event_date, event.ends_at) }}</li>
      <li v-if="paid" class="sticker bg-brand-cream"><IconWallet /><span>{{ kits.length ? peso(Math.min(...kits.map((k) => Number(k.unit_price)))) : peso(fee) }}</span><span v-if="event.fee_note" class="sticker__note">({{ event.fee_note }})</span></li>
      <li v-if="slotsSticker && st?.canRegister && st.slotsLeft > 0" class="sticker bg-brand-blush"><IconUsers />{{ st.slotsLeft }} slots left</li>
    </ul>
    <p v-if="paid" class="mt-1 font-black">1 Form = 1 Entry</p>

    <div class="card-soft evt-head__panel">
      <InfoList class="text-ink">
        <InfoRow label="Venue:"><template #icon><IconMapPin /></template>{{ [event.venue, event.venue_address].filter(Boolean).join(", ") }} <a v-if="event.venue || event.venue_address" :href="mapsUrl(event)" target="_blank" rel="noopener noreferrer">Open in Google Maps <span class="sr-only">(opens in a new tab)</span></a></InfoRow>
        <InfoRow v-if="kits.length > 0" label="Kits:" :note="event.fee_note ? `Prices are ${event.fee_note}.` : null">
          <template #icon><IconPackage /></template>
          <span class="block"><span v-for="k in kits" :key="k.id" class="block">{{ k.name }}: <NoWrap>{{ peso(k.unit_price) }}</NoWrap></span></span>
        </InfoRow>
        <InfoRow v-else-if="fee > 0" label="Pre-registration fee:"><template #icon><IconWallet /></template><NoWrap>{{ peso(fee) }}</NoWrap>{{ event.fee_note ? ` (${event.fee_note})` : "" }}</InfoRow>
        <InfoRow v-if="paid" label="Mode of payment:"><template #icon><IconWallet /></template>GCash only</InfoRow>
        <InfoRow v-if="event.registration_deadline" label="Registration deadline:"><template #icon><IconLock /></template>{{ fmtDeadline(event.registration_deadline) }}</InfoRow>
        <InfoRow v-if="event.hashtags?.length > 0" label="Hashtags:"><template #icon><IconLink /></template>{{ event.hashtags.join(" ") }}</InfoRow>
      </InfoList>
    </div>
    <p v-if="requiredNote" class="mt-3 text-sm text-ink-muted">* Indicates required question</p>
  </header>
</template>
