<script setup lang="ts">
import { sanitize } from "~/lib/sanitize";

const exec = (cmd: string, arg?: string) => document.execCommand?.(cmd, false, arg);

// A built-in visual editor for the Terms: type, select text and press Bold / lists / Link. No HTML to write.
// What it produces is passed through the same whitelist sanitizer as the attendee page and the email. v-model is the HTML.
const props = defineProps({ id: String, modelValue: { type: String, default: "" } });
const emit = defineEmits(["update:modelValue"]);
const el = ref(null);
const urlEl = ref(null);
let last = null;            // the last HTML this editor itself emitted
let saved = null;           // the selection, kept while the link box has focus
const linkOpen = ref(false);
const url = ref("https://");
const BUTTONS = [
  { label: "Bold", run: () => exec("bold") }, { label: "Italic", run: () => exec("italic") }, { label: "Underline", run: () => exec("underline") },
  { label: "Bulleted list", run: () => exec("insertUnorderedList") }, { label: "Numbered list", run: () => exec("insertOrderedList") },
  { label: "Clear formatting", run: () => { exec("removeFormat"); exec("unlink"); } },
];
watch(linkOpen, async (o) => { if (o) { await nextTick(); urlEl.value?.focus(); } });

// load / reload when the value changes from outside (opening another event), not on every keystroke
watch(() => props.modelValue, (v) => { if (el.value && v !== last) { el.value.innerHTML = sanitize(v); last = v; } });
onMounted(() => { if (el.value) { el.value.innerHTML = sanitize(props.modelValue); last = props.modelValue; } });

function emitValue() {
  const html = sanitize(el.value.innerHTML);
  if (html !== el.value.innerHTML) {            // something the whitelist refuses (e.g. a dropped image): remove it from the box too
    el.value.innerHTML = html;
    const r = document.createRange(); r.selectNodeContents(el.value); r.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  last = html;
  emit("update:modelValue", html);
}
const run = (fn) => { el.value.focus(); fn(); emitValue(); };
function openLink() {
  const sel = window.getSelection();
  saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  linkOpen.value = true;
}
function applyLink() {
  const href = /^(https?:|mailto:)/i.test(url.value.trim()) ? url.value.trim() : `https://${url.value.trim()}`;
  el.value.focus();
  const sel = window.getSelection();
  if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
  if (sel.isCollapsed) exec("insertHTML", `<a href="${href.replace(/"/g, "%22")}">${href.replace(/[<>&]/g, "")}</a>`);
  else exec("createLink", href);
  linkOpen.value = false; url.value = "https://"; emitValue();
}
const onUrlKey = (e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") linkOpen.value = false; };
const onPaste = (e) => { e.preventDefault(); exec("insertText", e.clipboardData.getData("text/plain")); };
</script>

<template>
  <div class="space-y-2">
    <div role="toolbar" aria-label="Formatting" :aria-controls="id" class="flex flex-wrap gap-2">
      <button v-for="b in BUTTONS" :key="b.label" type="button" class="btn-secondary" @mousedown.prevent @click="run(b.run)">
        <b v-if="b.label === 'Bold'" aria-hidden="true" class="font-serif text-base leading-none">B</b>
        <i v-else-if="b.label === 'Italic'" aria-hidden="true" class="font-serif text-base leading-none">I</i>
        <u v-else-if="b.label === 'Underline'" aria-hidden="true" class="font-serif text-base leading-none">U</u>
        <IconList v-else-if="b.label === 'Bulleted list'" /><IconParagraph v-else-if="b.label === 'Numbered list'" />
        <span v-else aria-hidden="true" class="font-serif text-base leading-none">T<sub>x</sub></span>{{ b.label }}
      </button>
      <button type="button" class="btn-secondary" :aria-expanded="linkOpen" @mousedown.prevent @click="openLink"><IconLink />Link</button>
    </div>
    <div v-if="linkOpen" class="flex flex-wrap items-end gap-2 rounded-lg border border-link bg-brand-ivory p-3">
      <div class="min-w-0 flex-1">
        <label :for="`${id}-url`" class="label">Link address</label>
        <input :id="`${id}-url`" ref="urlEl" v-model="url" class="input" type="url" @keydown="onUrlKey">
      </div>
      <button type="button" class="btn-primary" @click="applyLink">Add link</button>
      <button type="button" class="btn-secondary" @click="linkOpen = false">Cancel</button>
    </div>
    <div :id="id" ref="el" role="textbox" aria-multiline="true" aria-label="Terms and Conditions" :aria-describedby="`${id}-help`" tabindex="0" contenteditable="true" class="input safe-html min-h-48 overflow-auto bg-white text-sm" @focus="exec('defaultParagraphSeparator', 'p')" @input="emitValue" @paste="onPaste" />
    <p :id="`${id}-help`" class="text-xs text-ink-muted">Type here and format it like a normal document. Select text, then press a button above. Pasted text keeps no outside styling.</p>
  </div>
</template>
