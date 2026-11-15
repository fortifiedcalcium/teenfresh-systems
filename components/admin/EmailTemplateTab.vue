<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { callFunction } from "~/lib/api";

const KINDS = [
  ["confirmation", "Confirmation (sent when a payment is verified)"],
  ["payment_underpaid", "Payment underpaid"],
  ["payment_rejected", "Payment rejected"],
  ["acknowledgment", "Registration received (optional, see Events)"],
];
const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const { user } = useAuth();
const toast = useToast();
const kind = ref("confirmation");
const draft = ref(null);
const loadError = ref("");
const testTo = ref(user.value?.email || "");
const busy = ref("");

watch([() => props.event.id, kind], () => {
  draft.value = null; loadError.value = "";
  supabase.from("email_templates").select("subject,html_body,text_body").eq("event_id", props.event.id).eq("kind", kind.value).maybeSingle()
    .then(({ data, error }) => {
      // Never show a blank editor after a failed load: saving it would overwrite the real template.
      if (error) loadError.value = /kind|42703/.test(`${error.code} ${error.message}`) ? "The database has not been updated yet (the email_templates.kind column is missing). Run supabase/migrations/002_registration_payments.sql in the Supabase SQL Editor. Your saved template is untouched." : `Could not load this template: ${error.message}`;
      else draft.value = data || { subject: "", html_body: "", text_body: "" };
    });
}, { immediate: true });

async function save() {
  busy.value = "save";
  const { error } = await supabase.from("email_templates").upsert({ event_id: props.event.id, kind: kind.value, ...draft.value, updated_at: new Date().toISOString() }, { onConflict: "event_id,kind" });
  busy.value = ""; if (error) toast(error.message, "error"); else toast("Template saved", "success");
}
async function test() {
  busy.value = "test";
  try { await callFunction("send-confirmation-email", { test_to: testTo.value, event_id: props.event.id, kind: kind.value, template: draft.value }); toast(`Test sent to ${testTo.value}`, "success"); }
  catch (e) { toast(e.message, "error"); } finally { busy.value = ""; }
}
</script>

<template>
  <Alert v-if="loadError" tone="bad">{{ loadError }}</Alert>
  <Loading v-else-if="!draft" />
  <div v-else class="space-y-4">
    <div><label for="tpl-kind" class="label">Email</label>
      <select id="tpl-kind" v-model="kind" class="input max-w-lg"><option v-for="[k, l] in KINDS" :key="k" :value="k">{{ l }}</option></select></div>
    <EmailEditor v-model:draft="draft" :event="event" :ensure-qr="kind === 'confirmation'" />
    <div class="page-actions flex flex-wrap items-center gap-2 border-t border-link pt-4">
      <button type="button" class="btn-primary" :disabled="!!busy" @click="save"><IconSave />{{ busy === "save" ? "Saving…" : "Save template" }}</button>
      <input v-model="testTo" type="email" class="input max-w-xs" aria-label="Send test to">
      <button type="button" class="btn-secondary" :disabled="!!busy || !testTo" @click="test"><IconSend />{{ busy === "test" ? "Sending…" : "Send test to myself" }}</button>
    </div>
  </div>
</template>
