<script setup lang="ts">
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange } from "~/lib/availability";
import { peso } from "~/lib/payment";
import { eventPath } from "~/lib/slug";
import { imageUrl } from "~/lib/eventImages";
import type { EventRow, ImageRow, KitRow } from "~/types/db";

// One event as a keepsake card, the same language as the home hero: the poster is a tilted photocard on a pastel stage (the colour follows `band`),
// the facts are stickers, and the action is one button. The whole poster is always shown, so printed text is never cropped.
const props = withDefaults(defineProps<{ event: EventRow; registered: number; bannerImage?: ImageRow; kits?: Pick<KitRow, "unit_price">[]; band?: number }>(), { kits: () => [], band: 0 });
const st = computed(() => eventStatus(props.event, props.registered));
const fee = computed(() => Number(props.event.registration_fee));
const poster = computed(() => (props.event.banner_coming_soon ? null : imageUrl(props.bannerImage)));
const STAGES = ["bg-brand-coral", "bg-brand-mint", "bg-brand-blue"];   // ink text only: the contrast check forbids the muted ink on coral and blue
const stage = computed(() => STAGES[props.band % STAGES.length]);
const tilt = computed(() => (props.band % 2 === 0 ? "-2deg" : "2deg"));
const titleId = `kc-${useId()}`;
const slots = computed(() => (st.value.canRegister ? `${st.value.slotsLeft} of ${props.event.capacity} slots left` : st.value.label));
const deadline = computed(() => (st.value.canRegister && props.event.registration_deadline ? `Register by ${fmtDeadline(props.event.registration_deadline)}` : ""));
</script>

<template>
  <article class="kcard" :aria-labelledby="titleId">
    <div :class="['kcard__stage', stage]">
      <div class="photocard photocard--sm" :style="{ '--tilt': tilt }">
        <ComingSoonBanner v-if="event.banner_coming_soon" ratio="4 / 5" class="photocard__img" />
        <img v-else-if="poster" :src="poster" :alt="bannerImage?.alt_text || ''" class="photocard__img" loading="lazy" decoding="async" width="1600" height="2000">
        <div v-else class="photocard__img photocard__img--empty"><span>{{ event.title }}</span></div>
      </div>
    </div>
    <div class="kcard__body">
      <div>
        <h2 :id="titleId" :title="event.title" class="line-clamp-2 text-xl font-black leading-snug">{{ event.title }}</h2>
        <p v-if="event.subtitle" class="line-clamp-2 text-ink-muted">{{ event.subtitle }}</p>
      </div>
      <ul class="hero2__stickers" aria-label="Event details">
        <li class="sticker sticker--sm bg-brand-mint"><IconCalendar />{{ fmtDate(event.event_date) }}</li>
        <li class="sticker sticker--sm bg-brand-sky"><IconClock />{{ fmtTimeRange(event.event_date, event.ends_at) }}</li>
        <li v-if="kits.length > 0 || fee > 0 || event.price_info" class="sticker sticker--sm bg-brand-cream">
          <IconTicket /><KitPrices v-if="kits.length > 0" :kits="kits" /><NoWrap v-else-if="fee > 0">{{ peso(fee) }}</NoWrap><template v-else>{{ event.price_info }}</template>
        </li>
        <li class="sticker sticker--sm bg-brand-blush"><IconUsers />{{ slots }}</li>
      </ul>
      <p v-if="event.venue || deadline" class="text-sm text-ink-muted">{{ [event.venue, deadline].filter(Boolean).join(" · ") }}</p>
      <div class="mt-auto">
        <BaseButton v-if="st.canRegister" :to="eventPath(event)" variant="accent" block :aria-label="`Register for ${event.title}`"><IconTicket />Register</BaseButton>
        <BaseButton v-else :to="eventPath(event)" variant="secondary" block><IconInfo />View event</BaseButton>
      </div>
    </div>
  </article>
</template>
