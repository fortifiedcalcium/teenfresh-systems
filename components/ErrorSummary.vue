<script setup>
// 3.3.1 / 3.3.3: a summary of every error at the top of the form, each item linking to its field.
// It appears, and takes focus, only after a SUBMIT FAILS (the form bumps `focusSignal` from useErrorFocus): never because errors
// changed while someone was typing, which stole focus and announced itself as an alert on every keystroke.
// Give it a `key` that changes per step so each step starts with no summary. `errors` is { field: "message" }; `labels` maps field name -> visible label.
const props = defineProps({ errors: { type: Object, default: () => ({}) }, labels: { type: Object, default: () => ({}) }, focusSignal: { type: Number, default: 0 }, fieldIds: { type: Object, default: () => ({}) }, extra: String });
const el = ref(null);
const armed = ref(false);
let seen = props.focusSignal;     // the signal value when this summary was created: not a failed submit

const items = computed(() => {
  const list = Object.entries(props.errors).map(([name, e]) => ({ name, message: typeof e === "string" ? e : e?.message })).filter((i) => i.message);
  if (props.extra) list.unshift({ name: "_extra", message: props.extra });
  return list;
});
const show = computed(() => items.value.length > 0 && (armed.value || props.extra));

watch(() => props.focusSignal, async (v) => { if (v !== seen) { seen = v; armed.value = true; await nextTick(); el.value?.focus(); } });
// a problem only the server can find (wrong password, X username taken ...) arrives after the submit: focus it once
watch(() => props.extra, async (v) => { if (v) { await nextTick(); el.value?.focus(); } });
const jump = (name) => document.getElementById(props.fieldIds[name] || name)?.focus();
</script>

<template>
  <div v-if="show" ref="el" tabindex="-1" role="alert" class="error-summary" aria-labelledby="error-summary-title">
    <span class="error-icon" aria-hidden="true">!</span>
    <div class="min-w-0 flex-1">
      <h2 id="error-summary-title" class="error-summary__title">There {{ items.length === 1 ? "is 1 problem" : `are ${items.length} problems` }} with your submission</h2>
      <ul class="error-summary__list">
        <li v-for="i in items" :key="i.name">
          <template v-if="i.name === '_extra'">{{ i.message }}</template>
          <a v-else :href="`#${fieldIds[i.name] || i.name}`" class="error-summary__link" @click.prevent="jump(i.name)">{{ labels[i.name] ? `${labels[i.name]}: ` : "" }}{{ i.message }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>
