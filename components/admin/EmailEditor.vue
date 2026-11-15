<script setup lang="ts">
import type { PropType } from "vue";
import { MERGE_FIELDS, renderEmail, SAMPLE_EXTRA, SAMPLE_REG } from "~/lib/merge.js";
import { fetchEventImages, imageUrl } from "~/lib/eventImages";
import { FORMATS, wrapSelection } from "~/lib/formatText";
import { qrDataUrl } from "~/lib/qrImage.js";

// HTML editor + merge-field chips + live preview. Used for both the saved template and the one-off bulk message. v-model:draft is { subject, html_body, text_body }.
const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true }, ensureQr: Boolean });
const draft = defineModel("draft", { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true });
const els = { html_body: ref(null), text_body: ref(null), subject: ref(null) };
const focus = ref("html_body");
const view = ref("html");
const banner = ref(null);
const tag = (f) => `{{${f}}}`;
const QR = "{{QR Code}}";
const glyph = { bold: "B", italic: "I", underline: "U" };

function insert(field) {
  const tag = `{{${field}}}`;
  const el = els[focus.value].value;
  const v = draft.value[focus.value];
  const [s, e] = el ? [el.selectionStart ?? v.length, el.selectionEnd ?? v.length] : [v.length, v.length];
  draft.value = { ...draft.value, [focus.value]: v.slice(0, s) + tag + v.slice(e) };
  nextTick(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length); });
}
function format(kind) {
  const f = FORMATS[kind], el = els.html_body.value, v = draft.value.html_body;
  const [a, b] = el ? [el.selectionStart ?? v.length, el.selectionEnd ?? v.length] : [v.length, v.length];
  const r = wrapSelection(v, a, b, f.open, f.close, f.placeholder);
  draft.value = { ...draft.value, html_body: r.value };
  nextTick(() => { el?.focus(); el?.setSelectionRange(r.start, r.end); });
}
function onKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  const kind = Object.keys(FORMATS).find((k) => (FORMATS as Record<string, any>)[k].key === e.key.toLowerCase());
  if (kind) { e.preventDefault(); format(kind); }
}
const set = (k) => (e) => { draft.value = { ...draft.value, [k]: e.target.value }; };

watch(() => props.event.id, (id) => { fetchEventImages(id).then((imgs) => { const r = imgs.email_banner || imgs.banner; banner.value = r ? { url: imageUrl(r), alt: r.alt_text } : null; }); }, { immediate: true });
// the preview uses the same merge code as the Edge Functions, with a sample attendee and sample payment details
const qrUrl = computed(() => { try { return qrDataUrl(SAMPLE_REG.ticket_number); } catch { return null; } });
const preview = computed(() => renderEmail(draft.value as any, { reg: SAMPLE_REG, event: props.event, qrUrl: qrUrl.value, ensureQr: props.ensureQr, site: window.location.origin, bannerUrl: banner.value?.url ?? props.event.banner_url, bannerAlt: banner.value?.alt, extra: SAMPLE_EXTRA }));
const focusLabel = computed(() => focus.value.replace("_body", "").replace("html", "HTML body").replace("text", "text body"));
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="space-y-3">
      <div>
        <p class="label">Merge fields <span class="font-normal text-ink-muted">(click to insert at the cursor in: {{ focusLabel }})</span></p>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="f in MERGE_FIELDS" :key="f" type="button" class="chip" @click="insert(f)">{{ tag(f) }}</button>
        </div>
      </div>
      <div><label class="label" for="subj">Subject</label><input id="subj" :ref="(el) => { els.subject.value = el; }" class="input" :value="draft.subject" @focus="focus = 'subject'" @input="set('subject')($event)"></div>
      <div>
        <label class="label" for="html">HTML body</label>
        <div role="toolbar" aria-label="Text formatting for the HTML body" aria-controls="html" class="mb-1 flex flex-wrap gap-2">
          <button v-for="(f, k) in (FORMATS as Record<string, any>)" :key="k" type="button" class="btn-secondary" :aria-label="f.key ? `${f.label} (Ctrl+${f.key.toUpperCase()})` : f.label" @click="format(k)">
            <span v-if="glyph[k]" aria-hidden="true" class="font-serif text-base leading-none"><b v-if="k === 'bold'">B</b><i v-else-if="k === 'italic'">I</i><u v-else>U</u></span>
            <template v-else><IconLink v-if="k === 'link'" /><IconParagraph v-else />{{ f.label }}</template>
          </button>
        </div>
        <textarea id="html" :ref="(el) => { els.html_body.value = el; }" rows="14" class="input font-mono text-xs" :value="draft.html_body" @keydown="onKey" @focus="focus = 'html_body'" @input="set('html_body')($event)" />
      </div>
      <div><label class="label" for="txt">Plain-text body</label><textarea id="txt" :ref="(el) => { els.text_body.value = el; }" rows="9" class="input font-mono text-xs" :value="draft.text_body" @focus="focus = 'text_body'" @input="set('text_body')($event)" /></div>
      <p class="text-xs text-ink-muted">Unknown fields are left blank, and every value is HTML-escaped before it is inserted. <template v-if="ensureQr">The ticket QR code is added automatically above the Terms; put <code>{{ QR }}</code> where you want it to appear instead.</template></p>
    </div>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="label mb-0">Live preview <span class="font-normal text-ink-muted">(sample attendee)</span></p>
        <div class="flex gap-1"><button v-for="v in ['html', 'text']" :key="v" type="button" :class="view === v ? 'btn-primary px-3 py-1' : 'btn-secondary px-3 py-1'" @click="view = v"><IconCode v-if="v === 'html'" /><IconFileText v-else />{{ v === "html" ? "HTML" : "Plain text" }}</button></div>
      </div>
      <p class="rounded-lg bg-brand-ivory p-2 text-sm"><strong>Subject:</strong> {{ preview.subject }}</p>
      <iframe v-if="view === 'html'" title="Email preview" sandbox="" :srcdoc="preview.html" class="h-[640px] w-full rounded-lg border border-link bg-white" />
      <pre v-else class="h-[640px] overflow-auto whitespace-pre-wrap rounded-lg border border-link bg-white p-3 font-sans text-sm">{{ preview.text }}</pre>
    </div>
  </div>
</template>
