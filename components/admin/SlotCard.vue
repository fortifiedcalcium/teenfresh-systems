<script setup lang="ts">
import type { PropType } from "vue";
import { imageUrl, removeEventImage, saveImageAlt, SLOTS, uploadEventImage } from "~/lib/eventImages";
import { fmtDateTime } from "~/lib/availability";
import { supabase } from "~/lib/supabaseClient";

const props = defineProps({ event: Object as PropType<Record<string, any>>, slotKey: String, row: Object as PropType<Record<string, any>> });
const emit = defineEmits(["reload", "eventChanged"]);
const spec = computed(() => SLOTS[props.slotKey]);
const toast = useToast();
const alt = ref(props.row?.alt_text || "");
const busy = ref(false);
const confirm = ref(false);
const broken = ref(false);
watch(() => props.row, (r) => { alt.value = r?.alt_text || ""; broken.value = false; });
const url = computed(() => imageUrl(props.row));
const inputId = computed(() => `file-${props.slotKey}`);
const isBanner = computed(() => props.slotKey === "banner");
const soon = computed(() => isBanner.value && !!props.event.banner_coming_soon);

async function run(fn, ok) { busy.value = true; try { await fn(); toast(ok, "success"); emit("reload"); } catch (e) { toast(e.message, "error"); } finally { busy.value = false; } }
const setSoon = (on) => run(async () => {
  const { error } = await supabase.from("events").update({ banner_coming_soon: on }).eq("id", props.event.id);
  if (error) throw new Error(error.message);
  emit("eventChanged");
}, on ? "The banner now shows “Coming soon”" : "The banner shows the image again");
function onFile(e) { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(() => uploadEventImage(props.event, props.slotKey, f, alt.value, props.row), `${spec.value.label} ${props.row ? "replaced" : "uploaded"}`); }
async function doRemove() { await run(() => removeEventImage(props.row), `${spec.value.label} removed`); confirm.value = false; }
</script>

<template>
  <li class="card space-y-3 p-4">
    <div><h3 class="text-lg">{{ spec.label }}</h3><p class="text-sm text-ink-muted">{{ spec.where }}</p></div>
    <div class="mx-auto max-w-[14rem] overflow-hidden rounded-lg border border-link bg-brand-sky">
      <ComingSoonBanner v-if="soon" ratio="16 / 9" />
      <img v-else-if="url && !broken" :src="url" :alt="alt || `${spec.label} preview`" class="block h-auto w-full" @error="broken = true">
      <div v-else class="flex items-center justify-center p-3 text-center text-sm font-semibold" :style="{ aspectRatio: spec.ratio }">{{ broken ? "The image could not be loaded" : spec.placeholder }}</div>
    </div>
    <label v-if="isBanner" class="flex items-start gap-2 text-sm font-semibold">
      <input type="checkbox" class="check mt-0.5" :checked="soon" :disabled="busy" @change="setSoon(($event.target as HTMLInputElement).checked)">
      <span>Show “Coming soon” instead of a banner image<span class="block font-normal text-ink-muted">Attendees see a Coming soon panel on the event card. Any uploaded image is kept and returns when this is off.</span></span>
    </label>
    <p class="text-sm">Recommended: {{ spec.recommended }}. JPG, PNG or WebP, 10 MB at most.<template v-if="row"> Last updated {{ fmtDateTime(row.updated_at) }}.</template></p>
    <div class="flex flex-wrap gap-2">
      <input :id="inputId" type="file" accept="image/jpeg,image/png,image/webp" class="file-input sr-only" :disabled="busy" @change="onFile">
      <label :for="inputId" class="btn-primary cursor-pointer" :aria-disabled="busy"><IconUpload />{{ busy ? "Working…" : row ? "Replace image" : "Upload image" }} <span class="sr-only">for {{ spec.label }}</span></label>
      <button v-if="row" type="button" class="btn-secondary" :disabled="busy" @click="confirm = true"><IconTrash />Remove <span class="sr-only">{{ spec.label }}</span></button>
    </div>
    <form v-if="row" class="flex flex-wrap items-end gap-2" @submit.prevent="run(() => saveImageAlt(row, alt), 'Alt text saved')">
      <div class="min-w-0 flex-1">
        <label :for="`alt-${slotKey}`" class="label">Alt text</label>
        <input :id="`alt-${slotKey}`" v-model="alt" class="input" :aria-describedby="`alt-hint-${slotKey}`">
        <p :id="`alt-hint-${slotKey}`" class="hint">Describe the image for people who cannot see it. Posters are images of text, so the event info is also shown as real text on the page.</p>
      </div>
      <button class="btn-secondary" :disabled="busy"><IconSave />Save alt text</button>
    </form>
    <ConfirmDialog v-if="confirm" :title="`Remove ${spec.label}?`" confirm-label="Remove image" :busy="busy" @cancel="confirm = false" @confirm="doRemove">The page will show the placeholder again.</ConfirmDialog>
  </li>
</template>
