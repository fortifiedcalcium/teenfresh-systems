<script setup lang="ts">
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange, STATUS_TONE } from "~/lib/availability";
import { peso } from "~/lib/payment";
import { eventPath } from "~/lib/slug";
import { imageUrl } from "~/lib/eventImages";
import type { EventRow, ImageRow, KitRow } from "~/types/db";
import type { Tone } from "~/types/ui";

// One event as a concert ticket: photo, pastel header with the title and status, a compact grid (date, time, fee, slots left), the slots bar,
// a barcode strip and the Register button.
const props = withDefaults(defineProps<{ event: EventRow; registered: number; bannerImage?: ImageRow; kits?: Pick<KitRow, "unit_price">[]; band?: number; priority?: boolean; compact?: boolean }>(), { kits: () => [], band: 0 });
const st = computed(() => eventStatus(props.event, props.registered));
const fee = computed(() => Number(props.event.registration_fee));
const taken = computed(() => Math.min(props.registered, props.event.capacity));
const soon = computed(() => Boolean(props.event.banner_coming_soon));   // an admin switched the banner to "Coming soon"
const image = computed(() => (soon.value || props.compact ? null : imageUrl(props.bannerImage)));   // a compact card (home "Upcoming events") has no photo
const explainId = `explain-${useId()}`;
const slotsText = computed(() => (st.value.key === "closed" ? "Closed" : `${st.value.slotsLeft} of ${props.event.capacity}`));
const feeNote = computed(() => (props.event.fee_note ? `(${props.event.fee_note})` : ""));
</script>

<template>
  <TicketCard :title="event.title" :subtitle="event.subtitle || undefined" :image="image" :image-alt="bannerImage?.alt_text || ''" :band="band" :priority="priority" :status-label="st.label" :status-tone="(STATUS_TONE as Record<string, Tone>)[st.key]" :barcode="compact ? undefined : (event.slug || event.id)">
    <template v-if="soon && !compact" #media><ComingSoonBanner /></template>
    <div v-if="compact" class="space-y-1">
      <p class="font-bold">{{ fmtDate(event.event_date) }}, {{ fmtTimeRange(event.event_date, event.ends_at) }}</p>
      <p v-if="event.venue" class="text-xs text-ink-muted">{{ event.venue }}</p>
      <p v-if="!st.canRegister" :id="explainId" class="text-sm text-danger">Registration is unavailable. {{ st.reason }}</p>
    </div>
    <template v-else>
    <dl class="event-facts">
      <div><dt>Date</dt><dd>{{ fmtDate(event.event_date) }}</dd></div>
      <div><dt>Time</dt><dd>{{ fmtTimeRange(event.event_date, event.ends_at) }}</dd></div>
      <div>
        <dt>{{ kits.length > 0 ? "Kits" : "Fee" }}</dt>
        <dd><KitPrices v-if="kits.length > 0" :kits="kits" /><NoWrap v-else-if="fee > 0">{{ peso(fee) }}</NoWrap><template v-else>{{ event.price_info || "Free" }}</template><span v-if="feeNote && (kits.length > 0 || fee > 0)" class="event-facts__note">{{ feeNote }}</span></dd>
      </div>
      <div><dt>Slots left</dt><dd>{{ slotsText }}</dd></div>
    </dl>
    <div class="mt-3 space-y-2">
      <AvailabilityBar :registered="taken" :capacity="event.capacity" :label="`Slots taken for ${event.title}`" />
      <p v-if="event.venue || event.registration_deadline" class="text-xs text-ink-muted">{{ event.venue }}<template v-if="event.venue && event.registration_deadline"> · </template><template v-if="event.registration_deadline">Registration closes {{ fmtDeadline(event.registration_deadline) }}</template></p>
      <p v-if="!st.canRegister" :id="explainId" class="text-sm text-danger">Registration is unavailable. {{ st.reason }}</p>
    </div>
    </template>
    <template #action>
      <BaseButton v-if="st.canRegister" :to="eventPath(event)" variant="accent" block :aria-label="`Register for ${event.title}`"><IconTicket />Register</BaseButton>
      <BaseButton v-else :to="eventPath(event)" variant="secondary" block :aria-describedby="explainId"><IconInfo />View event</BaseButton>
    </template>
  </TicketCard>
</template>
