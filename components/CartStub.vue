<script setup lang="ts">
// The cart as a ticket stub: the lines on the left (slot "lines"), a perforated edge with two notches, the summary on the right (default slot).
</script>

<template>
  <section class="cstub grid gap-0 lg:grid-cols-[1fr_22rem]" aria-label="Your cart">
    <div class="p-4 sm:p-5"><slot name="lines" /></div>
    <div class="relative p-5 lg:pl-8">
      <span class="cstub__edge max-lg:hidden" aria-hidden="true" />
      <hr class="mb-4 border-t-2 border-dashed border-brand-sky lg:hidden" aria-hidden="true">
      <slot />
    </div>
  </section>
</template>
