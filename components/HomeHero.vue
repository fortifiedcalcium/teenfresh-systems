<script setup lang="ts">
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange } from "~/lib/availability";
import { peso } from "~/lib/payment";
import { eventPath } from "~/lib/slug";
import { imageUrl } from "~/lib/eventImages";
import type { EventRow, ImageRow, KitRow } from "~/types/db";

// The home hero as a fan's keepsake: the poster is a tilted photocard, the facts are stickers on the page beside it, and Register is the one loud
// button. Everything a visitor needs to decide (when, what time, how much, how many slots are left) is readable without scrolling.
const props = defineProps<{ event: EventRow; registered: number; banner?: ImageRow; kits?: Pick<KitRow, "unit_price">[]; headline: string; description: string; shop?: boolean }>();
const st = computed(() => eventStatus(props.event, props.registered));
const fee = computed(() => Number(props.event.registration_fee));
const poster = computed(() => (props.event.banner_coming_soon ? null : imageUrl(props.banner)));
const slots = computed(() => (st.value.canRegister ? `${st.value.slotsLeft} of ${props.event.capacity} slots left` : st.value.label));
const when = computed(() => [props.event.venue, props.event.registration_deadline && st.value.canRegister ? `Register by ${fmtDeadline(props.event.registration_deadline)}` : ""].filter(Boolean).join(" · "));
</script>

<template>
  <div class="hero2">
    <div class="hero2__text">
      <h1 id="home-h" class="hero2__title">{{ headline }}</h1>
      <p class="hero2__lead max-w-prose text-ink-muted">{{ description }}</p>

      <ul class="hero2__stickers" aria-label="Event details">
        <li class="sticker bg-brand-mint"><IconCalendar />{{ fmtDate(event.event_date) }}</li>
        <li class="sticker bg-brand-sky"><IconClock />{{ fmtTimeRange(event.event_date, event.ends_at) }}</li>
        <li v-if="(kits?.length || 0) > 0 || fee > 0 || event.price_info" class="sticker bg-brand-cream">
          <IconTicket /><KitPrices v-if="(kits?.length || 0) > 0" :kits="kits || []" /><template v-else-if="fee > 0"><NoWrap>{{ peso(fee) }}</NoWrap><span v-if="event.fee_note" class="sticker__note">({{ event.fee_note }})</span></template><template v-else>{{ event.price_info }}</template>
        </li>
        <li class="sticker bg-brand-blush"><IconUsers />{{ slots }}</li>
      </ul>

      <div class="flex flex-wrap gap-3">
        <BaseButton v-if="st.canRegister" :to="eventPath(event)" variant="accent" :aria-label="`Register for ${event.title}`"><IconTicket />Register</BaseButton>
        <BaseButton v-else :to="eventPath(event)" variant="secondary"><IconInfo />View event</BaseButton>
        <BaseButton v-if="shop" to="/shop" variant="secondary"><IconBag />Browse shop</BaseButton>
      </div>
      <p v-if="when" class="text-sm text-ink-muted">{{ when }}</p>
    </div>

    <div class="hero2__card">
      <div class="photocard">
        <ComingSoonBanner v-if="event.banner_coming_soon" ratio="4 / 5" class="photocard__img" />
        <img v-else-if="poster" :src="poster" :alt="banner?.alt_text || event.title" class="photocard__img" fetchpriority="high" decoding="async" width="1600" height="2000">
        <div v-else class="photocard__img photocard__img--empty"><span>{{ event.title }}</span></div>
      </div>
    </div>
  </div>
</template>
