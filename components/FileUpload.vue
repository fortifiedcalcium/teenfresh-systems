<script setup lang="ts">
import type { PropType } from "vue";
import { formatBytes, RECEIPT_ACCEPT, validateReceiptFile } from "~/lib/payment";

// Receipt picker. Works with the keyboard (the native file input is focusable and the label is its button);
// drag and drop is an extra, never the only way. Announces the chosen file and any problem. v-model is the File (or null).
const props = defineProps({ id: { type: String, required: true }, label: { type: String, default: "Attach payment receipt" }, modelValue: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, default: null }, error: String, required: { type: Boolean, default: true } });
const emit = defineEmits(["update:modelValue"]);
const announce = useAnnounce();
const input = ref(null);
const hintId = `${props.id}-hint`;
const over = ref(false);
const preview = ref(null);
const localError = ref("");

watch(() => props.modelValue, (file, _old, onCleanup) => {
  if (!file || !file.type.startsWith("image/")) { preview.value = null; return; }
  const url = URL.createObjectURL(file as Blob);
  preview.value = url;
  onCleanup(() => URL.revokeObjectURL(url));
}, { immediate: true });

function take(f) {
  const problem = validateReceiptFile(f);
  if (problem) { localError.value = problem; announce(problem, "assertive"); return; }
  localError.value = "";
  emit("update:modelValue", f);
  announce(`Selected ${f.name}, ${formatBytes(f.size)}`);
}
function remove() { emit("update:modelValue", null); localError.value = ""; if (input.value) input.value.value = ""; announce("Receipt removed"); input.value?.focus(); }
const shownError = computed(() => localError.value || props.error);
const onChange = (e) => { if (e.target.files?.[0]) take(e.target.files[0]); e.target.value = ""; };
const onDrop = (e) => { over.value = false; if (e.dataTransfer.files?.[0]) take(e.dataTransfer.files[0]); };
</script>

<template>
  <div :class="shownError ? 'field-error' : undefined">
    <p :id="`${id}-label`" class="label">{{ label }}<span v-if="required" class="font-normal text-ink-muted"> (required)</span></p>
    <!-- Drag and drop is only a shortcut; the keyboard path is the real file input below. -->
    <div :class="['rounded-lg border-2 border-dashed p-4 text-center', over ? 'border-ink bg-brand-sky' : shownError ? 'border-danger bg-white' : 'border-link bg-white']" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
      <input :id="id" ref="input" type="file" :accept="RECEIPT_ACCEPT" class="file-input sr-only" :aria-labelledby="`${id}-label`" :aria-describedby="[hintId, shownError ? `${id}-err` : null].filter(Boolean).join(' ')" :aria-required="required ? 'true' : undefined" :aria-invalid="shownError ? 'true' : undefined" @change="onChange">
      <label :for="id" class="btn-secondary cursor-pointer"><IconUpload />{{ modelValue ? "Replace file" : "Choose file" }}</label>
      <p :id="hintId" class="hint">or drag and drop it here. JPG, PNG, WebP or PDF, one file, up to 10 MB.</p>
    </div>
    <p v-if="shownError" :id="`${id}-err`" class="field-msg"><span class="error-icon error-icon--sm" aria-hidden="true">!</span>{{ shownError }}</p>

    <div class="mt-3">
      <p class="text-sm font-semibold">Files submitted:</p>
      <ul v-if="modelValue" class="mt-1 space-y-2">
        <li class="flex flex-wrap items-center gap-3 rounded-lg border border-link bg-white p-2 text-sm">
          <img data-allow-save v-if="preview" :src="preview" alt="Preview of your receipt" class="h-20 w-20 rounded object-cover" width="80" height="80">
          <span v-else aria-hidden="true" class="flex h-20 w-20 items-center justify-center rounded bg-brand-sky font-bold">PDF</span>
          <span class="min-w-0 flex-1 break-all"><span class="font-semibold">{{ modelValue.name }}</span><br><span class="text-ink-muted">{{ formatBytes(modelValue.size) }}</span></span>
          <button type="button" class="btn-secondary" @click="remove"><IconTrash />Remove <span class="sr-only">{{ modelValue.name }}</span></button>
        </li>
      </ul>
      <p v-else class="text-sm text-ink-muted">No file yet.</p>
    </div>
  </div>
</template>
