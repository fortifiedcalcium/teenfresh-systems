<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, validateImageFile } from "~/lib/eventImages";
import { BANNER_ALT_MAX, HERO_DESCRIPTION_MAX, HERO_HEADLINE_MAX, bannerUrl, removeBanner, uploadBanner, validateBanner, validateHeroText } from "~/lib/homeSettings";
import { fmtDate } from "~/lib/availability";

// Admin: the home page banner picture and which event is featured in the hero.
const toast = useToast();
const announce = useAnnounce();
const accept = Object.keys(IMAGE_TYPES).join(",");
const loaded = ref(false);
const saving = ref(false);
const error = ref("");
const events = ref<{ id: string; title: string; event_date: string }[]>([]);
const saved = ref<{ banner_path: string | null }>({ banner_path: null });
const form = reactive({ alt: "", decorative: false, featured: "", headline: "", description: "" });
const file = ref<File | null>(null);          // a newly chosen picture, uploaded on Save
const removing = ref(false);
const preview = ref<string | null>(null);

onMounted(async () => {
  const [s, e] = await Promise.all([supabase.from("home_settings").select("*").maybeSingle(), supabase.from("events").select("id,title,event_date").order("event_date", { ascending: false })]);
  events.value = (e.data || []) as typeof events.value;
  if (s.error) error.value = "The home page settings are not set up yet. Run migration 034_home_settings.sql in Supabase first.";
  const d = s.data;
  saved.value = { banner_path: d?.banner_path || null };
  Object.assign(form, { alt: d?.banner_alt || "", decorative: !!d?.banner_decorative, featured: d?.featured_event_id || "", headline: d?.hero_headline || "", description: d?.hero_description || "" });
  loaded.value = true;
});
watch(file, (f, _o, onCleanup) => {
  if (!f) { preview.value = null; return; }
  const url = URL.createObjectURL(f);
  preview.value = url;
  onCleanup(() => URL.revokeObjectURL(url));
});
const shown = computed(() => preview.value || (!removing.value ? bannerUrl(saved.value) : null));
const hasImage = computed(() => !!file.value || (!!saved.value.banner_path && !removing.value));
function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0]; input.value = "";
  if (!f) return;
  const bad = validateImageFile(f);
  if (bad) { error.value = bad; announce(bad, "assertive"); } else { error.value = ""; file.value = f; removing.value = false; }
}
function removePicture() { file.value = null; removing.value = true; }

async function save() {
  error.value = "";
  const bad = validateBanner({ hasImage: hasImage.value, decorative: form.decorative, alt: form.alt });
  if (bad) { error.value = bad; return; }
  const textBad = validateHeroText(form.headline.trim(), form.description.trim());
  if (textBad) { error.value = textBad; return; }
  saving.value = true;
  let newPath: string | null = null;
  try { if (file.value) newPath = await uploadBanner(file.value); } catch (e) { saving.value = false; error.value = (e as Error).message; return; }
  const path = newPath || (removing.value ? null : saved.value.banner_path);
  const { error: err } = await supabase.from("home_settings").update({
    banner_path: path, banner_alt: path ? form.alt.trim() || null : null, banner_decorative: path ? form.decorative : false,
    featured_event_id: form.featured || null, hero_headline: form.headline.trim() || null, hero_description: form.description.trim() || null, updated_at: new Date().toISOString(),
  }).eq("id", true);
  saving.value = false;
  if (err) { if (newPath) await removeBanner(newPath); error.value = err.message; return; }
  if (saved.value.banner_path && path !== saved.value.banner_path) await removeBanner(saved.value.banner_path);   // tidy up the replaced file
  saved.value = { banner_path: path }; file.value = null; removing.value = false;
  if (!path) Object.assign(form, { alt: "", decorative: false });
  toast("Home page saved", "success");
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl"><IconImage />Home page</h1>
    <AdminSwitch group="events" />
    <p class="text-sm text-ink-muted">The banner at the top of the home page: its picture, its text and the event shown there. Changes show up straight away; no redeploy is needed. Without a picture the page keeps its plain cream background.</p>
    <Loading v-if="!loaded" label="Loading settings…" />
    <form v-else class="card space-y-5 p-4" novalidate aria-labelledby="banner-h" @submit.prevent="save">
      <h2 id="banner-h" class="text-lg font-black">Banner picture</h2>
      <Alert v-if="error" tone="bad">{{ error }}</Alert>
      <div class="flex flex-wrap items-start gap-4">
        <div class="w-full max-w-sm overflow-hidden rounded-2xl border border-link bg-brand-ivory">
          <img v-if="shown" :src="shown" alt="Banner preview" class="aspect-video w-full object-cover">
          <div v-else class="flex aspect-video w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-ink-muted">JPG, PNG or WebP, up to {{ MAX_IMAGE_BYTES / 1024 / 1024 }} MB. Wide pictures work best, about 1920 x 1080 px.</p>
          <label class="btn-secondary cursor-pointer"><IconUpload />{{ hasImage ? "Change picture" : "Add a picture" }}<input type="file" class="sr-only" :accept="accept" @change="onFile"></label>
          <button v-if="hasImage" type="button" class="btn-secondary ml-2" @click="removePicture"><IconTrash />Remove</button>
          <p v-if="file" class="text-sm">Selected: {{ file.name }} (saved when you press Save)</p>
        </div>
      </div>
      <template v-if="hasImage">
        <Field id="banner-alt" v-slot="a" label="Describe the picture" :hint="form.decorative ? 'Not needed for a decorative picture.' : 'Short and plain, for people who cannot see it.'" :required="!form.decorative">
          <input v-bind="a" v-model="form.alt" class="input" :maxlength="BANNER_ALT_MAX" :disabled="form.decorative">
        </Field>
        <label class="flex items-center gap-2 font-semibold"><input v-model="form.decorative" type="checkbox" class="check"> Decorative (the picture says nothing a person needs to know)</label>
      </template>
      <h2 class="text-lg font-black">Banner text</h2>
      <Field id="hero-headline" v-slot="a" label="Headline (the event name)" hint="The big line in the banner. Leave it empty to use the featured event's headline, subtitle or title.">
        <input v-bind="a" v-model="form.headline" class="input" :maxlength="HERO_HEADLINE_MAX">
      </Field>
      <Field id="hero-description" v-slot="a" label="Description under the headline" :hint="`Up to ${HERO_DESCRIPTION_MAX} characters. Leave it empty for the standard sentence.`">
        <textarea v-bind="a" v-model="form.description" class="input" rows="3" :maxlength="HERO_DESCRIPTION_MAX" />
      </Field>
      <h2 class="text-lg font-black">Featured event</h2>
      <Field id="featured" v-slot="a" label="Event shown in the banner" hint="The headline and the ticket in the banner come from this event. Automatic picks the next event people can still register for.">
        <select v-bind="a" v-model="form.featured" class="input">
          <option value="">Automatic</option>
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }} ({{ fmtDate(e.event_date) }})</option>
        </select>
      </Field>
      <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? "Saving…" : "Save" }}</button>
    </form>
  </div>
</template>
