<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { productImageUrl, removeProductImage, uploadProductImage } from "~/lib/products.js";
import { IMAGE_TYPES, validateImageFile } from "~/lib/eventImages.js";

// GCash details and QR code of the checkout.
const toast = useToast();
const s = ref(null);
const saving = ref(false);
const error = ref("");
const file = ref(null);          // a newly chosen QR image, uploaded on Save
const removeQr = ref(false);
const preview = ref(null);
onMounted(() => {
  supabase.from("shop_settings").select("*").maybeSingle().then(({ data }) => { s.value = { gcash_account_name: data?.gcash_account_name || "", gcash_account_number: data?.gcash_account_number || "", gcash_qr_path: data?.gcash_qr_path || null }; });
});
watch(file, (f, _o, onCleanup) => {
  if (!f) { preview.value = null; return; }
  const url = URL.createObjectURL(f);
  preview.value = url;
  onCleanup(() => URL.revokeObjectURL(url));
});
const shownQr = computed(() => preview.value || (!removeQr.value && s.value?.gcash_qr_path ? productImageUrl({ image_path: s.value.gcash_qr_path }) : null));
const accept = Object.keys(IMAGE_TYPES).join(",");
function onFile(e) {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  const bad = validateImageFile(f);
  if (bad) error.value = bad; else { error.value = ""; file.value = f; removeQr.value = false; }
}
async function save() {
  error.value = "";
  saving.value = true;
  let newPath = null;
  try { if (file.value) newPath = await uploadProductImage(file.value); } catch (e) { saving.value = false; error.value = e.message; return; }
  const qrPath = newPath || (removeQr.value ? null : s.value.gcash_qr_path);
  const { error: err } = await supabase.from("shop_settings").update({ gcash_qr_path: qrPath, gcash_account_name: s.value.gcash_account_name.trim() || null, gcash_account_number: s.value.gcash_account_number.trim() || null, updated_at: new Date().toISOString() }).eq("id", true);
  saving.value = false;
  if (err) { if (newPath) await removeProductImage(newPath); error.value = err.message; return; }
  if (s.value.gcash_qr_path && qrPath !== s.value.gcash_qr_path) await removeProductImage(s.value.gcash_qr_path);   // tidy up the replaced file
  s.value = { ...s.value, gcash_qr_path: qrPath }; file.value = null; removeQr.value = false;
  toast("Shop settings saved", "success");
}
</script>

<template>
  <Loading v-if="!s" label="Loading settings…" />
  <form v-else class="card space-y-4 p-4" novalidate aria-labelledby="settings-h" @submit.prevent="save">
    <h2 id="settings-h" class="text-lg font-black">Checkout settings</h2>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <div class="grid gap-4 md:grid-cols-2">
      <Field id="gcash_account_name" v-slot="a" label="GCash account name" hint="Shown to shoppers. Store it masked, for example BR**N CA**O S."><input v-bind="a" v-model="s.gcash_account_name" class="input"></Field>
      <Field id="gcash_account_number" v-slot="a" label="GCash number" hint="Checkout stays closed until this is set"><input v-bind="a" v-model="s.gcash_account_number" class="input" inputmode="numeric"></Field>
    </div>
    <fieldset class="space-y-3">
      <legend class="label">GCash QR code</legend>
      <div class="flex flex-wrap items-start gap-4">
        <div class="w-40 overflow-hidden rounded-2xl border border-link bg-brand-ivory">
          <img v-if="shownQr" :src="shownQr" alt="GCash QR code preview" class="w-full">
          <div v-else class="flex aspect-square w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
        </div>
        <div class="min-w-[12rem] flex-1 space-y-2">
          <input id="gcash_qr" type="file" :accept="accept" class="file-input sr-only" aria-describedby="gcash_qr-hint" @change="onFile">
          <label for="gcash_qr" class="btn-secondary cursor-pointer"><IconUpload />{{ shownQr ? "Replace QR code" : "Choose QR code" }}</label>
          <button v-if="file || (s.gcash_qr_path && !removeQr)" type="button" class="btn-secondary ml-2" @click="file ? (file = null) : (removeQr = true)"><IconClose />{{ file ? "Undo choice" : "Remove" }}</button>
          <p id="gcash_qr-hint" class="hint">Shown to shoppers at checkout next to the GCash number. JPG, PNG or WebP. It uploads when you save.</p>
        </div>
      </div>
    </fieldset>
    <div class="flex justify-end"><button class="btn-primary" :disabled="saving"><IconSave />{{ saving ? "Saving…" : "Save settings" }}</button></div>
  </form>
</template>
