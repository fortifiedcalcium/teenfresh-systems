<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { callFunction, friendlyError } from "~/lib/api.js";
import { stepSchemaFor } from "~/lib/validation.js";
import { zodErrors } from "~/lib/zodErrors.js";
import { contactLinkList } from "~/lib/contactLinks.js";
import { eventStatus } from "~/lib/availability.js";
import { findByRef, registerPath } from "~/lib/slug";
import { fetchEventImages } from "~/lib/eventImages.js";
import { normalizeFacebook, normalizePhone, normalizeReference, normalizeX, orderTotal, parseAmount, peso, receiptPath, reusablePayments, balanceLeft, validateReceiptFile, formatBytes } from "~/lib/payment.js";

definePageMeta({ middleware: ["auth"] });
const DEFAULTS = { email: "", agree: false, name: "", x_username: "", facebook_url: "", contact_number: "", kit_id: "", reuse_payment_id: "", sender_name: "", amount_paid: "", reference_number: "", notes: "" };
const FIELD_LABELS = { email: "Email", agree: "Confirmation", name: "Name", x_username: "X/Twitter username", facebook_url: "Facebook profile link", contact_number: "Contact number", kit_id: "Kit", sender_name: "Name of sender", amount_paid: "Amount paid", reference_number: "Reference number", receipt: "Payment receipt", notes: "Notes" };
const FIELD_IDS = { agree: "agree", receipt: "receipt" };

// Unsent progress lives in sessionStorage (this tab only). The receipt file is never stored.
const draftKey = (id) => `reg-draft:${id}`;
const loadDraft = (id) => { try { return JSON.parse(sessionStorage.getItem(draftKey(id)) || "null"); } catch { return null; } };
const saveDraft = (id, values, step) => { try { sessionStorage.setItem(draftKey(id), JSON.stringify({ values, step })); } catch { /* storage unavailable */ } };
const clearDraft = (id) => { try { sessionStorage.removeItem(draftKey(id)); } catch { /* ignore */ } };

const route = useRoute();
// The address holds the event's slug (or, from an old link, its id): find the event, and move an id address over to the slug.
const { data: eventRefs } = await supabase.from("events").select("id,slug");
const found = findByRef(eventRefs || [], String(route.params.slug));
const id = found?.id ?? String(route.params.slug);
if (found?.slug && found.slug !== route.params.slug) await navigateTo(registerPath(found), { replace: true });
const { user, profile } = useAuth();
const toast = useToast();
const announce = useAnnounce();
const event = ref(undefined); // undefined loading, null missing
const registered = ref(0);
const images = ref({});
const payments = ref([]);
const kits = ref([]);
useSeo({ title: "Register", noindex: true });
const draft = loadDraft(id);
const stepKey = ref(draft?.step || "info");
const v = reactive({ ...DEFAULTS, email: user.value?.email || "", ...(draft?.values || {}) });
const file = ref(null);
const errors = ref({});
const attempted = ref(false);         // after a failed "Next", the fields are re-checked as they change
const receiptError = ref("");
const submitting = ref(false);
const serverError = ref("");
const done = ref(null);
const emailState = ref("idle");
const [focusSignal, bumpFocus] = useErrorFocus();
const headingEl = ref(null);
const doneEl = ref(null);

async function loadAll() {
  const [ev, av, pay, imgs, kt] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("event_availability").select("registered").eq("event_id", id).maybeSingle(),
    supabase.from("payments").select("id,sender_name,amount_paid,reference_number,status,registrations(id,status,total_amount)").eq("event_id", id).eq("user_id", user.value.id).order("created_at"),
    fetchEventImages(id),
    supabase.from("event_kits").select("*").eq("event_id", id).eq("active", true).order("sort_order").order("created_at"),
  ]);
  event.value = ev.data ?? null; registered.value = av.data?.registered ?? 0; payments.value = pay.data || []; images.value = imgs; kits.value = kt.data || [];
}
let channel = null;
onMounted(() => {
  loadAll();
  channel = supabase.channel("reg-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_counts", filter: `event_id=eq.${id}` }, (p) => { registered.value = p.new?.registered ?? 0; })
    .subscribe();
});
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel); });

watch(profile, (p) => { if (p?.full_name && !v.name) v.name = p.full_name; }, { immediate: true });
watch(v, (values) => saveDraft(id, { ...values }, stepKey.value), { deep: true });

const fee = computed(() => Number(event.value?.registration_fee || 0));
const kitMode = computed(() => kits.value.length > 0);                       // the event offers kit options (otherwise: one flat fee, quantity 1)
const order = computed(() => orderTotal({ kit_id: v.kit_id }, kits.value, fee.value));
const total = computed(() => order.value.total);
const paid = computed(() => kitMode.value || fee.value > 0);                 // is there a payment step at all
const steps = computed(() => [
  { key: "info", label: "Event info and terms" }, { key: "participant", label: "Participant's information" },
  ...(kitMode.value ? [{ key: "kit", label: "Kit" }] : []),
  ...(paid.value ? [{ key: "payment", label: "Payment" }] : []), { key: "review", label: "Review and submit" },
]);
// with a single kit there is nothing to choose: select it
watch(kits, (k) => { if (k.length === 1 && !v.kit_id) v.kit_id = k[0].id; });
const stepIndex = computed(() => Math.max(0, steps.value.findIndex((s) => s.key === stepKey.value)));
const current = computed(() => steps.value[stepIndex.value].key);

// focus the step heading whenever the step changes (not on first render)
watch(current, async () => { await nextTick(); headingEl.value?.focus(); announce(`Step ${stepIndex.value + 1} of ${steps.value.length}: ${steps.value[stepIndex.value].label}`); });
watch(done, async (d) => { if (d) { await nextTick(); doneEl.value?.focus(); } });

const go = (key) => { stepKey.value = key; errors.value = {}; receiptError.value = ""; attempted.value = false; saveDraft(id, { ...v }, key); };
const next = () => go(steps.value[Math.min(stepIndex.value + 1, steps.value.length - 1)].key);
const back = () => go(steps.value[Math.max(stepIndex.value - 1, 0)].key);

const reusable = computed(() => reusablePayments(payments.value, total.value));
// changing the order can make an earlier payment too small: stop using it
watch([reusable, () => v.reuse_payment_id], () => { if (v.reuse_payment_id && !reusable.value.some((p) => p.id === v.reuse_payment_id)) { v.reuse_payment_id = ""; v.sender_name = ""; v.amount_paid = ""; v.reference_number = ""; } });
const reusedPayment = computed(() => payments.value.find((p) => p.id === v.reuse_payment_id));
function chooseReuse(value) {
  v.reuse_payment_id = value;
  const p = payments.value.find((x) => x.id === value);
  v.sender_name = p ? p.sender_name : ""; v.amount_paid = p ? String(p.amount_paid) : ""; v.reference_number = p ? p.reference_number : "";
  if (p) receiptError.value = "";
}

// each step is checked against the kits and the order total as they are right now
function validate() {
  errors.value = zodErrors(stepSchemaFor(current.value, { kits: kits.value, total: total.value }), v);
  if (current.value === "payment" && !v.reuse_payment_id) receiptError.value = validateReceiptFile(file.value) || ""; else receiptError.value = "";
  return Object.keys(errors.value).length === 0 && !receiptError.value;
}
function onNext() {
  if (validate()) next();
  else { attempted.value = true; bumpFocus(); }
}
watch([v, file], () => { if (attempted.value) validate(); }, { deep: true });
const shownErrors = computed(() => ({ ...errors.value, ...(receiptError.value ? { receipt: receiptError.value } : {}) }));
const notesLength = computed(() => (v.notes || "").length);

async function submitAll() {
  serverError.value = ""; submitting.value = true;
  let path = null;
  if (paid.value && !v.reuse_payment_id) {
    path = receiptPath(user.value.id, file.value);
    const up = await supabase.storage.from("payment-receipts").upload(path, file.value, { contentType: file.value.type, upsert: false });
    if (up.error) { submitting.value = false; serverError.value = "We couldn't upload your receipt. Check your connection and the file, then try again."; return; }
  }
  const { data, error } = await supabase.rpc("submit_registration", {
    p_event_id: id, p_name: v.name, p_x_username: v.x_username, p_email: v.email, p_facebook: v.facebook_url, p_contact: v.contact_number,
    p_notes: v.notes || null, p_agreed: v.agree, p_payment_id: v.reuse_payment_id || null,
    p_sender_name: v.reuse_payment_id ? null : v.sender_name, p_amount: v.reuse_payment_id ? null : parseAmount(v.amount_paid),
    p_reference: v.reuse_payment_id ? null : v.reference_number, p_receipt_path: path,
    p_kit_id: kitMode.value ? v.kit_id : null, p_quantity: 1,
  });
  submitting.value = false;
  if (error) { serverError.value = friendlyError(error); return; }
  clearDraft(id);
  done.value = { ...data, name: v.name, x_username: normalizeX(v.x_username), email: v.email };
  loadAll();
  if (data.status === "confirmed") {
    emailState.value = "sending";
    callFunction("send-confirmation-email", { registration_id: data.registration_id }).then(() => { emailState.value = "sent"; }, (e) => { emailState.value = "failed"; toast(e.message, "error"); });
  } else if (event.value.send_ack_email) {
    callFunction("send-payment-email", { kind: "acknowledgment", registration_id: data.registration_id }).catch(() => {});
  }
}

function another() { Object.assign(v, { ...DEFAULTS, email: user.value?.email || "" }); file.value = null; done.value = null; emailState.value = "idle"; serverError.value = ""; go("info"); }

const st = computed(() => (event.value ? eventStatus(event.value, registered.value) : null));
const reviewSections = computed(() => {
  const out = [
    ["info", "Event info and terms", [["Email", v.email], ["Terms and Conditions", "Agreed"]]],
    ["participant", "Participant's information", [["Name", v.name], ["X/Twitter Username", "@" + normalizeX(v.x_username)], ["Facebook Profile Link", normalizeFacebook(v.facebook_url) || v.facebook_url], ["Contact Number", normalizePhone(v.contact_number) || v.contact_number]]],
  ];
  if (kitMode.value) out.push(["kit", "Kit", [["Kit", order.value.kit?.name || "Not chosen"], ["Price", peso(order.value.unit)], ["Total to pay", peso(total.value)]]]);
  if (paid.value) {
    const rp = reusedPayment.value;
    out.push(["payment", "Payment", rp
      ? [["Using the payment of", `${rp.sender_name}, ${peso(rp.amount_paid)}`], ["Reference Number", rp.reference_number], ["Notes", v.notes || "None"]]
      : [["Name of Sender", v.sender_name], ["Amount Paid", peso(parseAmount(v.amount_paid))], ["Reference Number", normalizeReference(v.reference_number)], ["Receipt", file.value ? `${file.value.name} (${formatBytes(file.value.size)})` : "Missing"], ["Notes", v.notes || "None"]]]);
  }
  return out;
});
const doneStatus = computed(() => done.value?.status === "confirmed");
const emailText = computed(() => (emailState.value === "sending" ? "Sending your confirmation email…" : emailState.value === "sent" ? "Confirmation email sent. Check your spam folder if you can't find it." : emailState.value === "failed" ? "We couldn't send the email yet. You can resend it from My registrations." : ""));
</script>

<template>
  <Loading v-if="event === undefined" label="Loading event…" class="p-12" logo />
  <p v-else-if="event === null" class="text-center">Event not found. <NuxtLink to="/">Back to events</NuxtLink></p>

  <!-- status page (after submit) -->
  <div v-else-if="done" class="mx-auto max-w-2xl space-y-4">
    <div :class="['alert block', doneStatus ? 'alert-ok' : 'alert-info']" role="status">
      <h1 ref="doneEl" tabindex="-1" class="flex items-center justify-center gap-2 text-xl"><IconCheckCircle v-if="doneStatus" /><IconClock v-else />{{ doneStatus ? "You're registered!" : "Registration received" }}</h1>
      <p class="mt-1"><Badge :tone="doneStatus ? 'ok' : 'warn'">{{ doneStatus ? "Confirmed" : "Pending verification" }}</Badge></p>
      <p v-if="doneStatus" class="mt-2">Your ticket number is <strong class="font-mono">{{ done.ticket_number }}</strong>. Keep the QR code below and the confirmation email we are sending to {{ done.email }}.</p>
      <p v-else class="mt-2">Your payment will be verified, and a confirmation email will be sent within 48 to 72 hours. Kindly keep it confidential as it is your personal ticket for entry.</p>
    </div>
    <RegistrationTicket v-if="doneStatus" :registration="{ name: done.name, x_username: done.x_username, ticket_number: done.ticket_number, status: 'confirmed' }" :event="event" />
    <p v-if="doneStatus" role="status" class="text-center text-sm text-ink-muted">{{ emailText }}</p>
    <div class="flex flex-wrap justify-center gap-2">
      <button type="button" class="btn-primary" @click="another"><IconPlus />Submit another form</button>
      <NuxtLink class="btn-secondary" to="/my-registrations"><IconTicket />Go to my registrations</NuxtLink>
    </div>
  </div>

  <div v-else-if="!st.canRegister" class="mx-auto max-w-2xl space-y-4">
    <h1 class="flex items-center gap-2 text-2xl"><IconTicket />Register</h1>
    <EventHeader :event="event" :st="st" :kits="kits" />
    <Alert tone="bad"><strong>{{ st.label }}.</strong> {{ st.reason }} <NuxtLink to="/">Back to events</NuxtLink></Alert>
  </div>

  <div v-else class="mx-auto max-w-3xl space-y-4">
    <h1 class="flex items-center gap-2 text-2xl"><IconTicket />Register</h1>
    <EventHeader :event="event" :st="st" :kits="kits" />
    <Stepper :steps="steps" :current="stepIndex" />

    <form class="card space-y-5 p-5" novalidate aria-labelledby="step-heading" @submit.prevent>
      <h2 id="step-heading" ref="headingEl" tabindex="-1" class="text-xl">{{ steps[stepIndex].label }}</h2>
      <ErrorSummary v-if="current !== 'review'" :key="current" :errors="shownErrors" :labels="FIELD_LABELS" :focus-signal="focusSignal" :field-ids="FIELD_IDS" />

      <!-- step 1 -->
      <template v-if="current === 'info'">
        <Field id="email" v-slot="a" label="Email" required hint="Your confirmation email will be sent here" :error="errors.email"><input v-bind="a" v-model="v.email" type="email" class="input" autocomplete="email"></Field>
        <section aria-labelledby="poster-h" class="space-y-2">
          <h3 id="poster-h" class="text-lg">EVENT POSTER</h3>
          <EventImage slot-key="poster" :event="event" :image="images.poster" class="mx-auto max-w-md" @changed="loadAll" />
        </section>
        <section aria-labelledby="details-h" class="space-y-2">
          <h3 id="details-h" class="text-lg">EVENT DETAILS</h3>
          <EventImage slot-key="details_card" :event="event" :image="images.details_card" class="mx-auto max-w-md" @changed="loadAll" />
          <div v-if="event.kit_inclusions?.length > 0" class="rounded-lg bg-brand-ivory p-3 text-sm">
            <p class="font-semibold">Kit inclusions</p>
            <ul class="mt-1 list-disc pl-5"><li v-for="k in event.kit_inclusions" :key="k">{{ k }}</li></ul>
          </div>
        </section>
        <section aria-labelledby="terms-h" class="space-y-3">
          <h3 id="terms-h" class="text-lg">EVENT TERMS AND CONDITIONS</h3>
          <div class="rounded-lg border border-link bg-brand-ivory p-4 text-sm"><SafeHtml :html="event.terms_html" />
            <div v-if="contactLinkList(event.contact_links).length > 0" class="mt-4"><p>If you have any concerns, please do not hesitate to contact us in any of our social media accounts!</p><ContactLinks :links="event.contact_links" /></div>
          </div>
        </section>
        <fieldset>
          <legend class="label">Confirmation <span class="font-normal text-ink-muted">(required)</span></legend>
          <p class="hint mb-1">Check all that apply.</p>
          <div class="flex items-start gap-3">
            <input id="agree" v-model="v.agree" type="checkbox" class="check mt-0.5" aria-required="true" :aria-invalid="errors.agree ? 'true' : undefined" :aria-describedby="errors.agree ? 'agree-err' : undefined">
            <label for="agree" class="min-h-target py-2 text-base">I have read and agree to the Terms and Conditions</label>
          </div>
          <p v-if="errors.agree" id="agree-err" class="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{{ errors.agree }}</p>
        </fieldset>
      </template>

      <!-- step 2 -->
      <template v-if="current === 'participant'">
        <p class="text-sm text-ink-muted">In case of error/corrections, you may send it on confirmation email afterwards.</p>
        <Field id="name" v-slot="a" label="Name" required hint="Please provide your name or nickname" :error="errors.name"><input v-bind="a" v-model="v.name" class="input" autocomplete="name"></Field>
        <Field id="x_username" v-slot="a" label="X/Twitter Username" required hint='Please put your username without "@" sign' :error="errors.x_username">
          <input v-bind="a" v-model="v.x_username" class="input" autocapitalize="none" autocorrect="off" :spellcheck="false" @blur="v.x_username = normalizeX(v.x_username)">
        </Field>
        <Field id="facebook_url" v-slot="a" label="Facebook Profile Link" required hint="e.g fb.com/TeenfreshPH" :error="errors.facebook_url"><input v-bind="a" v-model="v.facebook_url" class="input" inputmode="url" autocapitalize="none" :spellcheck="false"></Field>
        <Field id="contact_number" v-slot="a" label="Contact Number" required hint="Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX" :error="errors.contact_number"><input v-bind="a" v-model="v.contact_number" type="tel" class="input" autocomplete="tel"></Field>
        <p class="text-sm text-ink-muted">Privacy: your name, contact details and payment receipt are used only to verify your registration. Only the organizers can see them (Data Privacy Act of 2012).</p>
      </template>

      <!-- kit (one per form) -->
      <KitOrder v-if="current === 'kit'" v-model="v.kit_id" :kits="kits" :error="errors.kit_id" :order="order" />

      <!-- payment -->
      <template v-if="current === 'payment'">
        <p class="text-sm text-ink-muted">For any other questions and concerns, you may send it on the confirmation email afterwards.</p>
        <section aria-labelledby="pm-h" class="rounded-lg border border-link bg-brand-ivory p-4">
          <h3 id="pm-h" class="text-lg">PAYMENT METHOD</h3>
          <dl v-if="event.payment_account_number || event.payment_account_name" class="mt-2 space-y-2 text-sm">
            <div class="flex flex-wrap gap-2"><dt class="font-semibold">G Cash:</dt><dd>{{ event.payment_account_name }}</dd></div>
            <div class="flex flex-wrap items-center gap-3"><dt class="font-semibold">Account number:</dt><dd class="font-mono text-lg font-bold">{{ event.payment_account_number }}</dd><dd v-if="event.payment_account_number"><CopyButton :text="event.payment_account_number" /></dd></div>
            <div class="flex flex-wrap gap-2"><dt class="font-semibold">{{ kitMode ? "Amount to pay" : "Registration Fee" }}:</dt><dd>{{ kitMode ? `${peso(total)}${order.kit ? ` (${order.kit.name})` : ""}` : `${fee}php (Exclusive of food and drinks)` }}</dd></div>
          </dl>
          <Alert v-else tone="warn" class="mt-2">The payment details are not available yet. Please check back soon.</Alert>
          <p class="mt-3 text-sm">Kindly avoid using the "Money Protect" feature to avoid inconveniences and cancellation of your slot.</p>
        </section>
        <section aria-labelledby="qr-h" class="space-y-2">
          <h3 id="qr-h" class="text-lg">QR CODE</h3>
          <EventImage slot-key="gcash_qr" :event="event" :image="images.gcash_qr" class="mx-auto max-w-[16rem]" @changed="loadAll" />
          <p class="text-center text-sm text-ink-muted">Transfer fees may apply.</p>
        </section>

        <div v-if="reusable.length > 0">
          <label for="reuse" class="label">Use the payment details from one of my earlier forms</label>
          <select id="reuse" class="input" :value="v.reuse_payment_id || ''" aria-describedby="reuse-hint" @change="chooseReuse($event.target.value)">
            <option value="">No, I made a new payment</option>
            <option v-for="p in reusable" :key="p.id" :value="p.id">{{ p.sender_name }}, {{ peso(p.amount_paid) }}, ref …{{ p.reference_number.slice(-4) }} ({{ peso(balanceLeft(p)) }} left)</option>
          </select>
          <p id="reuse-hint" class="hint">A payment can cover several forms until its balance is used up. This form costs {{ peso(total) }}. Choosing one fills in and locks the fields below.</p>
        </div>

        <Field id="sender_name" v-slot="a" label="Name of Sender" required :error="errors.sender_name"><input v-bind="a" v-model="v.sender_name" class="input" :readonly="!!v.reuse_payment_id"></Field>
        <Field id="amount_paid" v-slot="a" label="Amount Paid" required :hint="`At least ${peso(total)}${kitMode && order.kit ? ` (${order.kit.name})` : ''}. Convenience or transaction fees are not covered. Send enough so that the kit price is complete.`" :error="errors.amount_paid">
          <input v-bind="a" v-model="v.amount_paid" class="input" inputmode="decimal" :readonly="!!v.reuse_payment_id">
        </Field>
        <Field id="reference_number" v-slot="a" label="Reference Number" required hint="Type it exactly as your banking app shows it" :error="errors.reference_number">
          <input v-bind="a" v-model="v.reference_number" class="input" autocomplete="off" autocapitalize="none" autocorrect="off" :spellcheck="false" maxlength="80" :readonly="!!v.reuse_payment_id">
        </Field>

        <div v-if="v.reuse_payment_id" class="rounded-lg border border-link p-3 text-sm"><p class="font-semibold">Payment receipt</p><p>Already submitted with your earlier form. No new file is needed.</p></div>
        <FileUpload v-else id="receipt" :model-value="file" :error="receiptError" @update:model-value="(f) => { file = f; receiptError = ''; }" />

        <Field id="notes" v-slot="a" label="Notes (optional)" :hint="`${notesLength} of 500 characters`" :error="errors.notes"><textarea v-bind="a" v-model="v.notes" class="input" rows="3" maxlength="500" /></Field>
        <p class="text-sm text-ink-muted">Privacy: your name, contact details and payment receipt are used only to verify your registration. Only the organizers can see them (Data Privacy Act of 2012).</p>
      </template>

      <!-- review -->
      <template v-if="current === 'review'">
        <p class="text-ink-muted">Check your details. Your ticket and confirmation email use exactly this information.</p>
        <section v-for="[key, title, rows] in reviewSections" :key="key" :aria-label="title" class="rounded-lg border border-link p-3">
          <div class="mb-2 flex items-center justify-between gap-2"><h3 class="text-lg">{{ title }}</h3><button type="button" class="btn-secondary" @click="go(key)"><IconPencil />Edit <span class="sr-only">{{ title }}</span></button></div>
          <dl class="space-y-1 text-sm"><div v-for="[k, val] in rows" :key="k" class="flex flex-wrap justify-between gap-2"><dt class="font-semibold">{{ k }}</dt><dd class="break-all text-right">{{ val }}</dd></div></dl>
        </section>
        <ReceiptPreview v-if="paid && !reusedPayment && file" :file="file" />
        <Alert v-if="paid && !reusedPayment && !file" tone="bad">Your receipt is missing (it is not saved if the page reloads). <button type="button" class="underline" @click="go('payment')">Attach it again</button>.</Alert>
        <Alert v-if="serverError" tone="bad">{{ serverError }}</Alert>
      </template>

      <div class="flex flex-wrap justify-between gap-2 border-t border-brand-sky pt-4">
        <button v-if="stepIndex > 0" type="button" class="btn-secondary" :disabled="submitting" @click="back"><IconArrowLeft />Back</button><span v-else />
        <button v-if="current === 'review'" type="button" class="btn-primary" :disabled="submitting || (paid && !reusedPayment && !file)" @click="submitAll"><IconSend />{{ submitting ? "Submitting…" : "Submit registration" }}</button>
        <button v-else type="button" class="btn-primary" @click="onNext"><IconArrowRight />{{ current === steps[steps.length - 2].key ? "Review registration" : "Next" }}</button>
      </div>
    </form>
  </div>
</template>
