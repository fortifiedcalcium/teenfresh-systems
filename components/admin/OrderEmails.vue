<script setup lang="ts">
import { supabase } from "~/lib/supabaseClient";
import { DEFAULT_TEMPLATES, ORDER_FIELDS, ORDER_KINDS, renderOrderEmail, unknownOrderFields } from "~/lib/orderEmail.js";

// Admin: the wording of each shop order email. The items, totals and delivery address are added automatically.
const LABEL = { order_paid: "Payment confirmed", order_balance_due: "Payment short", order_shipping_due: "Shipping fee to pay", order_shipped: "Order shipped", order_cancelled: "Order cancelled" };
const WHEN = {
  order_paid: "Sent when you mark an order as paid. It is the first email the shopper gets for an order.",
  order_balance_due: "Sent when you ask a shopper for the remaining amount after an underpayment. Use {{Amount Due}} for that amount.",
  order_shipping_due: "Sent when you set a shipping fee on a confirmed order. It asks the shopper to pay it and upload the receipt.",
  order_shipped: "Sent when you mark an order as shipped.",
  order_cancelled: "Sent when you cancel an order.",
};
const SAMPLE_ORDER = { id: "sample", order_number: "TF-000123", name: "Juan Dela Cruz", email: "juan@example.com", phone: "+639171234567", address: "12 Rizal St., Brgy. Poblacion", city: "Makati", postal_code: "1210", subtotal_php: 1500, shipping_php: 0, total_php: 1500, shipping_fee_php: 150, shipping_status: "awaiting_payment", balance_due_php: 250, balance_status: "awaiting_payment", courier: "J&T Express", tracking_number: "JT1234567890" };
const SAMPLE_ITEMS = [{ artist: "Marv", title: "ÖRBITAL", unit_price_php: 750, quantity: 2 }];
const wording = (rows, k) => { const r = rows?.[k]; return r ? { subject: r.subject, heading: r.heading, body: r.body } : DEFAULT_TEMPLATES[k]; };

const tag = (f) => `{{${f}}}`;
const toast = useToast();
const saved = ref(null);          // kind -> saved row
const kind = ref<string>(ORDER_KINDS[0]);
const draft = ref({ ...DEFAULT_TEMPLATES[ORDER_KINDS[0]] });
const busy = ref(false);
const error = ref("");

onMounted(() => { supabase.from("order_email_templates").select("*").then(({ data }) => { saved.value = Object.fromEntries((data || []).map((r) => [r.kind, r])); }); });
watch([kind, saved], () => { if (saved.value) { draft.value = { ...wording(saved.value, kind.value) }; error.value = ""; } });

const preview = computed(() => renderOrderEmail(kind.value as any, SAMPLE_ORDER, SAMPLE_ITEMS, "", draft.value));
const customised = computed(() => Boolean(saved.value?.[kind.value]));
const unchanged = computed(() => JSON.stringify(draft.value) === JSON.stringify(wording(saved.value, kind.value)));

async function save() {
  error.value = "";
  for (const [k, label] of [["subject", "Subject"], ["heading", "Heading"], ["body", "Message"]]) {
    if (!draft.value[k].trim()) { error.value = `${label} cannot be empty. To go back to the original wording, use "Restore default wording".`; return; }
    const bad = unknownOrderFields(draft.value[k]);
    if (bad.length) { error.value = `${label} has a placeholder that does not exist: {{${bad[0]}}}. Use ${ORDER_FIELDS.map((f) => `{{${f}}}`).join(", ")}.`; return; }
  }
  if (draft.value.subject.length > 200 || draft.value.heading.length > 120 || draft.value.body.length > 2000) { error.value = "The subject can be 200 characters, the heading 120 and the message 2000."; return; }
  busy.value = true;
  const row = { kind: kind.value, subject: draft.value.subject.trim(), heading: draft.value.heading.trim(), body: draft.value.body.trim(), updated_at: new Date().toISOString() };
  const { error: err } = await supabase.from("order_email_templates").upsert(row, { onConflict: "kind" });
  busy.value = false;
  if (err) { error.value = err.message; return; }
  saved.value = { ...saved.value, [kind.value]: row };
  toast(`${LABEL[kind.value]} email saved`, "success");
}
async function restore() {
  busy.value = true; error.value = "";
  const { error: err } = await supabase.from("order_email_templates").delete().eq("kind", kind.value);
  busy.value = false;
  if (err) { error.value = err.message; return; }
  const { [kind.value]: _removed, ...n } = saved.value; saved.value = n;
  toast("Original wording restored", "success");
}
</script>

<template>
  <Loading v-if="!saved" label="Loading emails…" />
  <div v-else class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl"><IconMail />Order emails</h1>
    <p class="text-sm text-ink-muted">Edit what shoppers read in their order emails. The items, totals and delivery address are added under your text automatically.</p>

    <div role="tablist" aria-label="Emails" class="flex flex-wrap gap-2">
      <button v-for="k in ORDER_KINDS" :id="`tab-${k}`" :key="k" type="button" role="tab" :aria-selected="kind === k" aria-controls="email-panel" :class="kind === k ? 'btn-primary' : 'btn-secondary'" @click="kind = k">{{ (LABEL as Record<string, string>)[k] }}<span v-if="saved[k]" class="sr-only"> (edited)</span></button>
    </div>

    <div id="email-panel" role="tabpanel" :aria-labelledby="`tab-${kind}`" class="grid gap-6 lg:grid-cols-2 lg:items-start">
      <form class="card space-y-4 p-4" novalidate @submit.prevent="save">
        <p class="text-sm">{{ WHEN[kind] }} <strong v-if="customised">Using your wording.</strong><template v-else>Using the original wording.</template></p>
        <Alert v-if="error" tone="bad">{{ error }}</Alert>
        <Field id="oe-subject" v-slot="a" label="Subject" required><input v-bind="a" v-model="draft.subject" class="input" maxlength="200"></Field>
        <Field id="oe-heading" v-slot="a" label="Heading" required hint="The big line at the top of the email"><input v-bind="a" v-model="draft.heading" class="input" maxlength="120"></Field>
        <Field id="oe-body" v-slot="a" label="Message" required hint="Leave a blank line to start a new paragraph"><textarea v-bind="a" v-model="draft.body" class="input" rows="8" maxlength="2000" /></Field>
        <p class="hint">Placeholders you can type: <span v-for="(f, i) in ORDER_FIELDS" :key="f"><template v-if="i > 0">, </template><code>{{ tag(f) }}</code></span>. They are replaced with each shopper's details.</p>
        <div class="flex flex-wrap justify-between gap-2 border-t border-brand-sky pt-3">
          <button type="button" class="btn-secondary" :disabled="busy || !customised" @click="restore"><IconRefresh />Restore default wording</button>
          <button class="btn-primary" :disabled="busy || unchanged"><IconSave />{{ busy ? "Saving…" : "Save wording" }}</button>
        </div>
      </form>

      <section class="card space-y-2 p-4" aria-labelledby="oe-preview-h">
        <h2 id="oe-preview-h" class="text-lg font-black">Preview</h2>
        <p class="text-sm text-ink-muted">With a sample order. This is the plain-text version; the email also has the Teenfresh header and a table of items.</p>
        <p class="text-sm"><span class="font-semibold">Subject:</span> {{ preview.subject }}</p>
        <pre class="whitespace-pre-wrap break-words rounded-lg border border-brand-sky bg-brand-ivory p-3 text-sm" aria-label="Email preview">{{ preview.text }}</pre>
      </section>
    </div>
  </div>
</template>
