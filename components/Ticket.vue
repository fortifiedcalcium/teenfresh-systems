<script setup>
// A vertical ticket: the main section on top (slot `image`, with the status `badge` slot as a chip on it, then the default slot) and the stub underneath (slot `stub`),
// split by a dashed perforation with a round notch cut out of each side (see assets/css/ticket.css). Purely presentational.
// `status`: confirmed | pending | attention | rejected | cancelled (a rejected ticket also gets a VOID stamp).
// The notches, perforation and stamp are decorative: aria-hidden, never focusable.
defineProps({ status: { type: String, default: "confirmed" }, labelledBy: String });
</script>

<template>
  <article class="ticket" :data-status="status" :aria-labelledby="labelledBy">
    <div class="ticket__top">
      <div class="ticket__fill">
        <div class="ticket__media"><slot name="image" /></div>
        <div v-if="$slots.badge" class="ticket__chip"><slot name="badge" /></div>
        <span v-if="status === 'rejected'" class="ticket__stamp" aria-hidden="true">VOID</span>
        <div class="ticket__content"><slot /></div>
      </div>
    </div>
    <div class="ticket__bottom">
      <div class="ticket__fill"><div class="ticket__stub"><slot name="stub" /></div></div>
    </div>
  </article>
</template>
