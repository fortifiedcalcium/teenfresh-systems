<script setup>
import { fmtDateTime } from "~/lib/availability.js";

// The ticket and QR code. Only a confirmed registration has a ticket number; anything else shows its status instead.
const props = defineProps({ registration: { type: Object, required: true }, event: Object });
const confirmed = computed(() => props.registration.status === "confirmed" && props.registration.ticket_number);
</script>

<template>
  <div class="card mx-auto max-w-md p-6 text-center">
    <h2 class="text-lg font-black">{{ event?.title }}</h2>
    <div v-if="confirmed" class="my-4"><TicketQr :ticket-number="registration.ticket_number" /></div>
    <p v-else :class="['alert my-6 justify-center font-semibold', registration.status === 'pending_verification' ? 'alert-warn' : 'alert-bad']">{{ registration.status === "pending_verification" ? "Your ticket will appear here once your payment is verified." : registration.status === "rejected" ? "This registration was rejected." : "This registration was cancelled." }}</p>
    <dl class="space-y-1 text-left text-sm">
      <div class="flex justify-between gap-4"><dt class="text-ink-muted">Name</dt><dd class="font-medium">{{ registration.name }}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-ink-muted">X username</dt><dd class="font-medium">@{{ registration.x_username }}</dd></div>
      <div v-if="event?.event_date" class="flex justify-between gap-4"><dt class="text-ink-muted">When</dt><dd class="font-medium">{{ fmtDateTime(event.event_date) }}</dd></div>
      <div v-if="event?.venue" class="flex justify-between gap-4"><dt class="text-ink-muted">Venue</dt><dd class="font-medium">{{ event.venue }}</dd></div>
      <div v-if="registration.checked_in_at" class="flex justify-between gap-4"><dt class="text-ink-muted">Checked in</dt><dd class="font-medium text-success">{{ fmtDateTime(registration.checked_in_at) }}</dd></div>
    </dl>
  </div>
</template>
