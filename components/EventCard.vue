<script setup lang="ts">
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange, STATUS_TONE } from "~/lib/availability";
import { peso } from "~/lib/payment";
import { eventPath } from "~/lib/slug";
import { imageUrl } from "~/lib/eventImages";
import type { EventRow, ImageRow, KitRow } from "~/types/db";
import type { Tone } from "~/types/ui";

// One event on the home page: a concert ticket (TicketCard) with the date, venue, price, how many slots are left, and a button.
const props = withDefaults(defineProps<{ event: EventRow; registered: number; bannerImage?: ImageRow; kits?: Pick<KitRow, "unit_price">[]; band?: number }>(), { kits: () => [], band: 0 });
const st = computed(() => eventStatus(props.event, props.registered));
const fee = computed(() => Number(props.event.registration_fee));
const taken = computed(() => Math.min(props.registered, props.event.capacity));
const soon = computed(() => Boolean(props.event.banner_coming_soon));   // an admin switched the banner to "Coming soon"
const image = computed(() => (soon.value ? null : imageUrl(props.bannerImage)));
const explainId = computed(() => `explain-${props.event.id}`);
const slotsText = computed(() => (st.value.key === "closed" ? "Registration is closed" : `${st.value.slotsLeft} of ${props.event.capacity} slots left`));
</script>

<template>
  <TicketCard :title="event.title" :subtitle="event.subtitle || undefined" :image="image" :image-alt="bannerImage?.alt_text || ''" :band="band" :status-label="st.label" :status-tone="(STATUS_TONE as Record<string, Tone>)[st.key]">
    <template v-if="soon" #media><ComingSoonBanner /></template>
    <InfoList>
      <InfoRow label="Date:"><template #icon><IconCalendar /></template>{{ fmtDate(event.event_date) }}</InfoRow>
      <InfoRow label="Time:"><template #icon><IconClock /></template>{{ fmtTimeRange(event.event_date, event.ends_at) }}</InfoRow>
      <InfoRow v-if="event.venue" label="Venue:"><template #icon><IconMapPin /></template>{{ event.venue }}</InfoRow>
      <InfoRow v-if="kits.length > 0" label="Kits:" :note="event.fee_note ? `(${event.fee_note})` : undefined"><template #icon><IconPackage /></template><KitPrices :kits="kits" /></InfoRow>
      <InfoRow v-else label="Fee:" :note="fee > 0 && event.fee_note ? `(${event.fee_note})` : undefined"><template #icon><IconWallet /></template><NoWrap v-if="fee > 0">{{ peso(fee) }}</NoWrap><template v-else>{{ event.price_info || "Free" }}</template></InfoRow>
      <InfoRow v-if="event.registration_deadline" label="Registration closes:"><template #icon><IconLock /></template>{{ fmtDeadline(event.registration_deadline) }}</InfoRow>
    </InfoList>
    <div class="mt-4 space-y-2">
      <AvailabilityBar :registered="taken" :capacity="event.capacity" :label="`Slots taken for ${event.title}`" />
      <p class="text-sm font-semibold text-ink">{{ slotsText }}</p>
      <p v-if="!st.canRegister" :id="explainId" class="text-sm text-danger">Registration is unavailable. {{ st.reason }}</p>
    </div>
    <template #action>
      <BaseButton v-if="st.canRegister" :to="eventPath(event)" variant="accent" block :aria-label="`Register for ${event.title}`"><IconTicket />Register</BaseButton>
      <BaseButton v-else :to="eventPath(event)" variant="secondary" block :aria-describedby="explainId"><IconInfo />View event</BaseButton>
    </template>
  </TicketCard>
</template>
