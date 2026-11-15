<script setup>
// Shows text an admin wrote with **bold** markers. Only bold is recognised, and everything else is plain text
// (Vue escapes it), so admin text can never add HTML. Line breaks are kept by the caller's CSS (white-space: pre-line).
const props = defineProps({ text: { type: [String, Number], default: "" } });
const parts = computed(() => {
  const src = String(props.text ?? "");
  const out = [];
  let last = 0;
  for (const m of src.matchAll(/\*\*(?!\s)([^*\n]*[^*\s])\*\*/g)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
});
</script>

<template><template v-for="(p, i) in parts" :key="i"><strong v-if="p.bold">{{ p.text }}</strong><template v-else>{{ p.text }}</template></template></template>
