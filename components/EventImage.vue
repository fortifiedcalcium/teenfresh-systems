<script setup lang="ts">
import type { PropType } from "vue";
import { imageUrl, SLOTS, uploadEventImage } from "~/lib/eventImages";

// One image slot of an event. Shows the uploaded image at its own size and proportions, or a placeholder with the
// slot's recommended aspect ratio when there is none or it fails to load. Admins get an "Upload image" button on the placeholder
// (not with `readOnly`, e.g. on an attendee's own ticket). `image` is the event_images row for the slot (or undefined).
const props = defineProps({ slotKey: { type: String, required: true }, event: Object as PropType<Record<string, any>>, image: Object as PropType<Record<string, any>>, lightbox: { type: Boolean, default: true }, readOnly: Boolean });
const emit = defineEmits(["changed"]);
const { isAdmin } = useAuth();
const toast = useToast();
const failed = ref(false);
const open = ref(false);
const busy = ref(false);
const inputId = `img-${useId()}`;
const spec = computed(() => SLOTS[props.slotKey]);
const url = computed(() => imageUrl(props.image));
watch(url, () => { failed.value = false; });
const alt = computed(() => props.image?.alt_text || `${spec.value.label} for ${props.event?.title || "the event"}`);

async function upload(file) {
  if (!file) return;
  busy.value = true;
  try { await uploadEventImage(props.event, props.slotKey, file, null, props.image); toast(`${spec.value.label} uploaded`, "success"); emit("changed"); }
  catch (e) { toast(e.message, "error"); }
  finally { busy.value = false; }
}
const pick = (e) => { upload(e.target.files?.[0]); e.target.value = ""; };
</script>

<template>
  <ComingSoonBanner v-if="slotKey === 'banner' && event?.banner_coming_soon" class="rounded-lg border border-link" />
  <div v-else-if="!url || failed" class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-link bg-brand-sky p-4 text-center text-ink" :style="{ aspectRatio: spec.ratio }" :data-placeholder="slotKey">
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></svg>
    <p class="font-semibold">{{ spec.placeholder }}</p>
    <template v-if="isAdmin && !readOnly && event">
      <p class="text-sm">Recommended: {{ spec.recommended }}. JPG, PNG or WebP, 10 MB at most.</p>
      <input :id="inputId" type="file" accept="image/jpeg,image/png,image/webp" class="file-input sr-only" @change="pick">
      <label :for="inputId" class="btn-secondary cursor-pointer" :aria-disabled="busy"><IconUpload />{{ busy ? "Uploading…" : "Upload image" }} <span class="sr-only">for {{ spec.label }}</span></label>
    </template>
  </div>
  <template v-else>
    <!-- The picture keeps its own proportions: full width, height follows the image (no cropping, no letterboxing).
         width/height only reserve room until the file has loaded; then the real dimensions take over. -->
    <div class="overflow-hidden rounded-lg border border-link bg-brand-sky">
      <button v-if="lightbox" type="button" class="block w-full" :aria-label="`View larger: ${alt}`" aria-haspopup="dialog" @click="open = true">
        <img :src="url" :alt="alt" :width="spec.w" :height="spec.h" loading="lazy" decoding="async" class="block h-auto w-full" @error="failed = true">
      </button>
      <img v-else :src="url" :alt="alt" :width="spec.w" :height="spec.h" loading="lazy" decoding="async" class="block h-auto w-full" @error="failed = true">
    </div>
    <Lightbox v-if="open" :url="url" :alt="alt" :title="spec.label" @close="open = false" />
  </template>
</template>
