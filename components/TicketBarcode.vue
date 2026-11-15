<script setup>
// Decorative barcode strip, drawn from the ticket number so every ticket looks different. It is NOT a scannable code.
const props = defineProps({ value: { type: String, default: "" } });
const bars = computed(() => {
  let seed = 7;
  for (const ch of String(props.value)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  const next = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed; };
  const out = [];
  for (let x = 0; x < 200;) {
    const w = 1 + (next() % 3), gap = 1 + (next() % 3);
    if (x + w > 200) break;
    out.push({ x, w });
    x += w + gap;
  }
  return out;
});
</script>

<template>
  <svg aria-hidden="true" focusable="false" viewBox="0 0 200 40" preserveAspectRatio="none" class="ticket__barcode text-ink" fill="currentColor"><rect v-for="b in bars" :key="b.x" :x="b.x" y="0" :width="b.w" height="40" /></svg>
</template>
