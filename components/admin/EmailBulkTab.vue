<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { callFunction } from "~/lib/api";

const props = defineProps({ event: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const { user } = useAuth();
const toast = useToast();
const draft = ref(null);
const loadError = ref("");
const filter = ref("all");
const count = ref(null);
const testTo = ref(user.value?.email || "");
const progress = ref(null);

watch(() => props.event.id, (id) => {
  supabase.from("email_templates").select("subject,html_body,text_body").eq("event_id", id).eq("kind", "confirmation").maybeSingle().then(({ data, error }) => { if (error) loadError.value = "Could not load the confirmation template. If you have not run supabase/migrations/002_registration_payments.sql yet, run it first."; else draft.value = data || { subject: "", html_body: "", text_body: "" }; });
}, { immediate: true });

watch([() => props.event.id, filter], async ([id, f]) => {
  count.value = null;
  let q = supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "confirmed");
  if (f === "checked_in") q = q.not("checked_in_at", "is", null);
  if (f === "not_checked_in") q = q.is("checked_in_at", null);
  if (f === "email_failed") {
    const { data } = await supabase.from("registration_email_status").select("status").eq("event_id", id).eq("status", "failed");
    count.value = data?.length ?? 0; return;
  }
  const { count: c } = await q; count.value = c ?? 0;
}, { immediate: true });

const body = computed(() => ({ event_id: props.event.id, filter: filter.value, template: draft.value }));
async function test() {
  try { await callFunction("send-bulk-email", { ...body.value, test_to: testTo.value }); toast(`Test sent to ${testTo.value}`, "success"); } catch (e) { toast(e.message, "error"); }
}
async function sendAll() {
  if (!count.value) return;
  if (!window.confirm(`Send this email to ${count.value} attendee(s)? This cannot be undone.`)) return;
  let offset = 0, sent = 0, failed = 0;
  progress.value = { done: 0, total: count.value };
  try {
    while (offset !== null) {
      const r = await callFunction("send-bulk-email", { ...body.value, offset });
      sent += r.sent; failed += r.failed; offset = r.next_offset;
      progress.value = { done: r.processed, total: r.total };
    }
    toast(`Done: ${sent} sent, ${failed} failed`, failed ? "error" : "success");
  } catch (e) { toast(e.message, "error"); }
  progress.value = null;
}
</script>

<template>
  <Alert v-if="loadError" tone="bad">{{ loadError }}</Alert>
  <Loading v-else-if="!draft" />
  <div v-else class="space-y-4">
    <p class="alert alert-info">Write a one-off message. It starts from your confirmation template and is <strong>not</strong> saved. Each recipient gets their own merged copy.</p>
    <EmailEditor v-model:draft="draft" :event="event" />
    <div class="flex flex-wrap items-center gap-2 border-t border-link pt-4">
      <label class="text-sm font-medium" for="grp">Recipients</label>
      <select id="grp" v-model="filter" class="input max-w-[14rem]">
        <option value="all">All confirmed attendees</option><option value="checked_in">Checked in</option><option value="not_checked_in">Not yet arrived</option><option value="email_failed">Confirmation email failed</option>
      </select>
      <span class="text-sm text-ink-muted">{{ count === null ? "…" : `${count} recipient${count === 1 ? "" : "s"}` }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <input v-model="testTo" type="email" class="input max-w-xs" aria-label="Send test to">
      <button type="button" class="btn-secondary" :disabled="!!progress || !testTo" @click="test"><IconSend />Send test to myself</button>
      <button type="button" class="btn-danger" :disabled="!!progress || !count" @click="sendAll"><IconSend />{{ progress ? `Sending ${progress.done}/${progress.total}…` : "Send to recipients" }}</button>
    </div>
  </div>
</template>
