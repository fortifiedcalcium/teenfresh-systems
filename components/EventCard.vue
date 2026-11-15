<script setup>
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange, STATUS_TONE } from "~/lib/availability.js";
import { peso } from "~/lib/payment.js";

const props = defineProps({ event: { type: Object, required: true }, registered: { type: Number, required: true }, bannerImage: Object, kits: { type: Array, default: () => [] } });
const emit = defineEmits(["changed"]);
const st = computed(() => eventStatus(props.event, props.registered));
const explainId = computed(() => `explain-${props.event.id}`);
const fee = computed(() => Number(props.event.registration_fee));
const slotsText = computed(() => (st.value.key === "closed" ? "Registration is closed" : `${st.value.slotsLeft} of ${props.event.capacity} slots left`));
</script>

<template>
  <article class="card flex h-full w-full flex-col overflow-hidden" :aria-labelledby="`title-${event.id}`">
    <EventImage slot-key="banner" :event="event" :image="bannerImage" :lightbox="false" class="!rounded-none !border-0" @changed="emit('changed')" />
    <div class="flex flex-1 flex-col p-4">
      <div :class="['flex items-start justify-between gap-3', event.subtitle ? 'mb-1' : 'mb-4']">
        <h2 :id="`title-${event.id}`" class="line-clamp-2 min-w-0 flex-1 text-lg font-black leading-snug" :title="event.title">{{ event.title }}</h2>
        <Badge :tone="STATUS_TONE[st.key]">{{ st.label }}</Badge>
      </div>
      <p v-if="event.subtitle" class="mb-4 line-clamp-2 text-sm text-ink-muted" :title="event.subtitle">{{ event.subtitle }}</p>
      <InfoList>
        <InfoRow label="Date:"><template #icon><IconCalendar /></template>{{ fmtDate(event.event_date) }}</InfoRow>
        <InfoRow label="Time:"><template #icon><IconClock /></template>{{ fmtTimeRange(event.event_date, event.ends_at) }}</InfoRow>
        <InfoRow v-if="event.venue" label="Venue:"><template #icon><IconMapPin /></template>{{ event.venue }}</InfoRow>
        <InfoRow v-if="kits.length > 0" label="Kits:" :note="event.fee_note ? `(${event.fee_note})` : null"><template #icon><IconPackage /></template><KitPrices :kits="kits" /></InfoRow>
        <InfoRow v-else label="Fee:" :note="fee > 0 && event.fee_note ? `(${event.fee_note})` : null"><template #icon><IconWallet /></template><NoWrap v-if="fee > 0">{{ peso(fee) }}</NoWrap><template v-else>{{ event.price_info || "Free" }}</template></InfoRow>
        <InfoRow v-if="event.registration_deadline" label="Registration closes:"><template #icon><IconLock /></template>{{ fmtDeadline(event.registration_deadline) }}</InfoRow>
      </InfoList>
      <div class="mt-auto space-y-2 pt-4">
        <AvailabilityBar :registered="registered" :capacity="event.capacity" :label="`Slots taken for ${event.title}`" />
        <p class="text-sm font-semibold text-ink">{{ slotsText }}</p>
        <NuxtLink v-if="st.canRegister" :to="`/events/${event.id}/register`" class="btn-primary w-full" :aria-label="`Register for ${event.title}`"><IconTicket />Register</NuxtLink>
        <template v-else>
          <button type="button" class="btn-primary w-full" aria-disabled="true" :aria-describedby="explainId" @click.prevent><IconTicket />Register</button>
          <p :id="explainId" class="text-sm text-danger">Registration is unavailable. {{ st.reason }}</p>
        </template>
      </div>
    </div>
  </article>
</template>
