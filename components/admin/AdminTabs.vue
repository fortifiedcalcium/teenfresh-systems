<script setup>
// A row of tabs above one panel. Arrow keys, Home and End move between tabs (the WAI-ARIA tabs pattern).
const props = defineProps({ id: String, label: String, tabs: { type: Array, required: true }, active: String });
const emit = defineEmits(["change"]);
const els = {};
function move(e, i) {
  const n = props.tabs.length;
  const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  emit("change", props.tabs[to].key);
  els[props.tabs[to].key]?.focus();
}
</script>

<template>
  <div class="space-y-4">
    <div role="tablist" :aria-label="label" class="flex flex-wrap gap-2">
      <button v-for="(t, i) in tabs" :id="`${id}-tab-${t.key}`" :key="t.key" :ref="(el) => { els[t.key] = el; }" type="button" role="tab" :aria-selected="active === t.key" :aria-controls="`${id}-panel`" :tabindex="active === t.key ? 0 : -1" :class="active === t.key ? 'btn-primary' : 'btn-secondary'" @click="emit('change', t.key)" @keydown="move($event, i)">{{ t.label }}</button>
    </div>
    <div :id="`${id}-panel`" role="tabpanel" :aria-labelledby="`${id}-tab-${active}`"><slot /></div>
  </div>
</template>
