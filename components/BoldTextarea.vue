<script setup>
const wrapLines = (t) => t.split("\n").map((l) => (l.trim() ? l.replace(/^(\s*)(.*?)(\s*)$/, "$1**$2**$3") : l)).join("\n");
const unwrapLines = (t) => t.split("\n").map((l) => l.replace(/\*\*([^*]+)\*\*/g, "$1")).join("\n");
const allBold = (t) => t.split("\n").filter((l) => l.trim()).every((l) => /^\s*\*\*[^*]+\*\*\s*$/.test(l));

// A textarea with a Bold button (and Ctrl/Cmd+B). Bold text is stored as **text**, which FormattedText shows as bold.
// v-model gives the new string. Extra attributes (id, aria-*) from <Field> go to the textarea.
defineOptions({ inheritAttrs: false });
const props = defineProps({ modelValue: { type: String, default: "" }, maxLength: Number, rows: { type: Number, default: 4 } });
const emit = defineEmits(["update:modelValue"]);
const el = ref(null);

function toggleBold() {
  const t = el.value;
  if (!t) return;
  const value = props.modelValue;
  const s = t.selectionStart;
  const e = t.selectionEnd;
  const sel = value.slice(s, e);
  let next;
  let from = s;
  let to;
  if (s === e) {                                                        // nothing selected: add a pair of markers and put the cursor between them
    next = value.slice(0, s) + "****" + value.slice(e);
    from = to = s + 2;
  } else if (value.slice(s - 2, s) === "**" && value.slice(e, e + 2) === "**") {   // the selection sits inside markers: remove them
    next = value.slice(0, s - 2) + sel + value.slice(e + 2);
    from = s - 2; to = e - 2;
  } else if (allBold(sel)) {                                            // the selection is already bold: remove the bold
    const u = unwrapLines(sel);
    next = value.slice(0, s) + u + value.slice(e);
    to = s + u.length;
  } else {
    const w = wrapLines(sel);
    next = value.slice(0, s) + w + value.slice(e);
    to = s + w.length;
  }
  if (props.maxLength && next.length > props.maxLength) return;
  emit("update:modelValue", next);
  nextTick(() => { t.focus(); t.setSelectionRange(from, to); });
}
const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleBold(); } };
</script>

<template>
  <div>
    <div role="toolbar" aria-label="Text formatting" class="mb-1 flex gap-1">
      <button type="button" class="btn-secondary min-w-0 px-3" aria-keyshortcuts="Control+B Meta+B" title="Bold (Ctrl+B or Cmd+B)" @click="toggleBold"><b aria-hidden="true">B</b><span class="sr-only">Bold</span></button>
    </div>
    <textarea ref="el" class="input" :rows="rows" :maxlength="maxLength" :value="modelValue" v-bind="$attrs" @input="emit('update:modelValue', $event.target.value)" @keydown="onKey" />
  </div>
</template>
