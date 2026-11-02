import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { callFunction, friendlyError } from "../../lib/api.js";
import { stepSchemaFor } from "../../lib/validation.js";
import { eventStatus } from "../../lib/availability.js";
import { fetchEventImages } from "../../lib/eventImages.js";
import { normalizeFacebook, normalizePhone, normalizeReference, normalizeX, orderTotal, parseAmount, peso, receiptPath, reusablePayments, balanceLeft, validateReceiptFile, formatBytes } from "../../lib/payment.js";
import Field from "../../components/Field.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import SafeHtml from "../../components/SafeHtml.jsx";
import EventImage from "../../components/EventImage.jsx";
import EventHeader from "../../components/EventHeader.jsx";
import CopyButton from "../../components/CopyButton.jsx";
import FileUpload from "../../components/FileUpload.jsx";
import KitOrder from "../../components/KitOrder.jsx";
import Stepper from "../../components/Stepper.jsx";
import TicketCard from "../../components/TicketCard.jsx";
import { contactLinkList } from "../../components/ContactLinks.jsx";
import ContactLinks from "../../components/ContactLinks.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAnnounce } from "../../a11y.jsx";
import { IconArrowLeft, IconArrowRight, IconCheckCircle, IconClock, IconPencil, IconPlus, IconSend, IconTicket } from "../../components/NavIcons.jsx";

const DEFAULTS = { email: "", agree: false, name: "", x_username: "", facebook_url: "", contact_number: "", kit_id: "", reuse_payment_id: "", sender_name: "", amount_paid: "", reference_number: "", notes: "" };
const FIELD_LABELS = { email: "Email", agree: "Confirmation", name: "Name", x_username: "X/Twitter username", facebook_url: "Facebook profile link", contact_number: "Contact number", kit_id: "Kit", sender_name: "Name of sender", amount_paid: "Amount paid", reference_number: "Reference number", receipt: "Payment receipt", notes: "Notes" };
const FIELD_IDS = { agree: "agree", receipt: "receipt" };

// Unsent progress lives in sessionStorage (this tab only). The receipt file is never stored.
const draftKey = (id) => `reg-draft:${id}`;
const loadDraft = (id) => { try { return JSON.parse(sessionStorage.getItem(draftKey(id)) || "null"); } catch { return null; } };
const saveDraft = (id, values, step) => { try { sessionStorage.setItem(draftKey(id), JSON.stringify({ values, step })); } catch { /* storage unavailable */ } };
const clearDraft = (id) => { try { sessionStorage.removeItem(draftKey(id)); } catch { /* ignore */ } };

export default function EventRegister() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const toast = useToast();
  const announce = useAnnounce();
  const [event, setEvent] = useState(undefined); // undefined loading, null missing
  const [registered, setRegistered] = useState(0);
  const [images, setImages] = useState({});
  const [payments, setPayments] = useState([]);
  const [kits, setKits] = useState([]);
  const draft = useMemo(() => loadDraft(id), [id]);
  const [stepKey, setStepKey] = useState(draft?.step || "info");
  const [file, setFile] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(null);
  const [emailState, setEmailState] = useState("idle");
  const [focusSignal, bumpFocus] = useErrorFocus();
  const headingRef = useRef(null);
  const doneRef = useRef(null);
  const feeRef = useRef(0);
  const kitsRef = useRef([]);
  const stepRef = useRef(stepKey);
  stepRef.current = stepKey;

  const form = useForm({
    shouldFocusError: false, // the error summary takes focus instead
    defaultValues: { ...DEFAULTS, email: user?.email || "", ...(draft?.values || {}) },
    // each step is checked against the kits and the order total as they are right now
    resolver: (values, ctx, opts) => zodResolver(stepSchemaFor(stepRef.current, { kits: kitsRef.current, total: orderTotal(values, kitsRef.current, feeRef.current).total }))(values, ctx, opts),
  });
  const { register, handleSubmit, getValues, setValue, watch, reset, formState: { errors, submitCount } } = form;

  const loadAll = useCallback(async () => {
    const [ev, av, pay, imgs, kt] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      supabase.from("event_availability").select("registered").eq("event_id", id).maybeSingle(),
      supabase.from("payments").select("id,sender_name,amount_paid,reference_number,status,registrations(id,status,total_amount)").eq("event_id", id).eq("user_id", user.id).order("created_at"),
      fetchEventImages(id),
      supabase.from("event_kits").select("*").eq("event_id", id).eq("active", true).order("sort_order").order("created_at"),
    ]);
    feeRef.current = Number(ev.data?.registration_fee || 0);
    kitsRef.current = kt.data || [];
    setEvent(ev.data ?? null); setRegistered(av.data?.registered ?? 0); setPayments(pay.data || []); setImages(imgs); setKits(kt.data || []);
  }, [id, user.id]);

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("reg-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_counts", filter: `event_id=eq.${id}` }, (p) => setRegistered(p.new?.registered ?? 0))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id, loadAll]);

  useEffect(() => { if (profile?.full_name && !getValues("name")) setValue("name", profile.full_name, { shouldDirty: false }); }, [profile, setValue, getValues]);
  useEffect(() => { const sub = watch((values) => saveDraft(id, values, stepRef.current)); return () => sub.unsubscribe(); }, [watch, id]);

  const fee = Number(event?.registration_fee || 0);
  const kitMode = kits.length > 0;                       // the event offers kit options (otherwise: one flat fee, quantity 1)
  const kitId = watch("kit_id");
  const order = orderTotal({ kit_id: kitId }, kits, fee);
  const total = order.total;
  const paid = kitMode || fee > 0;                       // is there a payment step at all
  const steps = useMemo(() => [
    { key: "info", label: "Event info and terms" }, { key: "participant", label: "Participant's information" },
    ...(kitMode ? [{ key: "kit", label: "Kit" }] : []),
    ...(paid ? [{ key: "payment", label: "Payment" }] : []), { key: "review", label: "Review and submit" },
  ], [paid, kitMode]);
  // with a single kit there is nothing to choose: select it
  useEffect(() => { if (kits.length === 1 && !getValues("kit_id")) setValue("kit_id", kits[0].id); }, [kits, setValue, getValues]);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.key === stepKey));
  const current = steps[stepIndex].key;

  // focus the step heading whenever the step changes (not on first render)
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } headingRef.current?.focus(); announce(`Step ${stepIndex + 1} of ${steps.length}: ${steps[stepIndex].label}`); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  const go = (key) => { stepRef.current = key; setStepKey(key); saveDraft(id, getValues(), key); };
  const next = () => go(steps[Math.min(stepIndex + 1, steps.length - 1)].key);
  const back = () => go(steps[Math.max(stepIndex - 1, 0)].key);

  const reuseId = watch("reuse_payment_id");
  const reusable = useMemo(() => reusablePayments(payments, total), [payments, total]);
  // changing the order can make an earlier payment too small: stop using it
  useEffect(() => { if (reuseId && !reusable.some((p) => p.id === reuseId)) { setValue("reuse_payment_id", ""); setValue("sender_name", ""); setValue("amount_paid", ""); setValue("reference_number", ""); } }, [reusable, reuseId, setValue]);
  const reusedPayment = payments.find((p) => p.id === reuseId);
  const chooseReuse = (value) => {
    setValue("reuse_payment_id", value);
    const p = payments.find((x) => x.id === value);
    setValue("sender_name", p ? p.sender_name : ""); setValue("amount_paid", p ? String(p.amount_paid) : ""); setValue("reference_number", p ? p.reference_number : "");
    if (p) setReceiptError("");
  };

  const checkReceipt = () => {
    if (current !== "payment" || getValues("reuse_payment_id")) { setReceiptError(""); return true; }
    const problem = validateReceiptFile(file);
    setReceiptError(problem || "");
    return !problem;
  };
  const onNext = handleSubmit(() => { if (checkReceipt()) next(); else bumpFocus(); }, () => { checkReceipt(); bumpFocus(); });

  const notesLength = (watch("notes") || "").length;

  const submitAll = async () => {
    setServerError(""); setSubmitting(true);
    const v = getValues();
    let path = null;
    if (paid && !v.reuse_payment_id) {
      path = receiptPath(user.id, file);
      const up = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { setSubmitting(false); setServerError("We couldn't upload your receipt. Check your connection and the file, then try again."); return; }
    }
    const { data, error } = await supabase.rpc("submit_registration", {
      p_event_id: id, p_name: v.name, p_x_username: v.x_username, p_email: v.email, p_facebook: v.facebook_url, p_contact: v.contact_number,
      p_notes: v.notes || null, p_agreed: v.agree, p_payment_id: v.reuse_payment_id || null,
      p_sender_name: v.reuse_payment_id ? null : v.sender_name, p_amount: v.reuse_payment_id ? null : parseAmount(v.amount_paid),
      p_reference: v.reuse_payment_id ? null : v.reference_number, p_receipt_path: path,
      p_kit_id: kitMode ? v.kit_id : null, p_quantity: 1,
    });
    setSubmitting(false);
    if (error) { setServerError(friendlyError(error)); return; }
    clearDraft(id);
    setDone({ ...data, name: v.name, x_username: normalizeX(v.x_username), email: v.email });
    loadAll();
    if (data.status === "confirmed") {
      setEmailState("sending");
      callFunction("send-confirmation-email", { registration_id: data.registration_id }).then(() => setEmailState("sent"), (e) => { setEmailState("failed"); toast(e.message, "error"); });
    } else if (event.send_ack_email) {
      callFunction("send-payment-email", { kind: "acknowledgment", registration_id: data.registration_id }).catch(() => {});
    }
  };

  const another = () => { reset({ ...DEFAULTS, email: user?.email || "" }); setFile(null); setDone(null); setEmailState("idle"); setServerError(""); stepRef.current = "info"; setStepKey("info"); };

  if (event === undefined) return <Loading label="Loading event…" className="p-12" logo />;
  if (event === null) return <p className="text-center">Event not found. <Link to="/">Back to events</Link></p>;

  // ---------------------------------------------------------------- status page (after submit)
  if (done) {
    const confirmed = done.status === "confirmed";
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className={`alert ${confirmed ? "alert-ok" : "alert-info"} block`} role="status">
          <h1 ref={doneRef} tabIndex={-1} className="flex items-center justify-center gap-2 text-xl">{confirmed ? <IconCheckCircle /> : <IconClock />}{confirmed ? "You're registered!" : "Registration received"}</h1>
          <p className="mt-1"><Badge tone={confirmed ? "ok" : "warn"}>{confirmed ? "Confirmed" : "Pending verification"}</Badge></p>
          {confirmed ? (
            <p className="mt-2">Your ticket number is <strong className="font-mono">{done.ticket_number}</strong>. Keep the QR code below and the confirmation email we are sending to {done.email}.</p>
          ) : (
            <p className="mt-2">Your payment will be verified, and a confirmation email will be sent within 48 to 72 hours. Kindly keep it confidential as it is your personal ticket for entry.</p>
          )}
        </div>
        {confirmed && <TicketCard registration={{ name: done.name, x_username: done.x_username, ticket_number: done.ticket_number, status: "confirmed" }} event={event} />}
        {confirmed && <p role="status" className="text-center text-sm text-ink-muted">{emailState === "sending" ? "Sending your confirmation email…" : emailState === "sent" ? "Confirmation email sent. Check your spam folder if you can't find it." : emailState === "failed" ? "We couldn't send the email yet. You can resend it from My registrations." : ""}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={another}><IconPlus />Submit another form</button>
          <Link className="btn-secondary" to="/my-registrations"><IconTicket />Go to my registrations</Link>
        </div>
      </div>
    );
  }

  const st = eventStatus(event, registered);
  if (!st.canRegister) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="flex items-center gap-2 text-2xl"><IconTicket />Register</h1>
        <EventHeader event={event} st={st} kits={kits} />
        <Alert tone="bad"><strong>{st.label}.</strong> {st.reason} <Link to="/">Back to events</Link></Alert>
      </div>
    );
  }

  const v = getValues();
  const reviewSections = [
    ["info", "Event info and terms", [["Email", v.email], ["Terms and Conditions", "Agreed"]]],
    ["participant", "Participant's information", [["Name", v.name], ["X/Twitter Username", "@" + normalizeX(v.x_username)], ["Facebook Profile Link", normalizeFacebook(v.facebook_url) || v.facebook_url], ["Contact Number", normalizePhone(v.contact_number) || v.contact_number]]],
  ];
  if (kitMode) reviewSections.push(["kit", "Kit", [["Kit", order.kit?.name || "Not chosen"], ["Price", peso(order.unit)], ["Total to pay", peso(total)]]]);
  if (paid) {
    reviewSections.push(["payment", "Payment", reusedPayment
      ? [["Using the payment of", `${reusedPayment.sender_name}, ${peso(reusedPayment.amount_paid)}`], ["Reference Number", reusedPayment.reference_number], ["Notes", v.notes || "None"]]
      : [["Name of Sender", v.sender_name], ["Amount Paid", peso(parseAmount(v.amount_paid))], ["Reference Number", normalizeReference(v.reference_number)], ["Receipt", file ? `${file.name} (${formatBytes(file.size)})` : "Missing"], ["Notes", v.notes || "None"]]]);
  }
  const privacy = <p className="text-sm text-ink-muted">Privacy: your name, contact details and payment receipt are used only to verify your registration. Only the organizers can see them (Data Privacy Act of 2012).</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl"><IconTicket />Register</h1>
      <EventHeader event={event} st={st} kits={kits} />
      <Stepper steps={steps} current={stepIndex} />

      <form onSubmit={(e) => e.preventDefault()} className="card space-y-5 p-5" noValidate aria-labelledby="step-heading">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-xl">{steps[stepIndex].label}</h2>
        {current !== "review" && <ErrorSummary key={current} errors={{ ...errors, ...(receiptError ? { receipt: { message: receiptError } } : {}) }} labels={FIELD_LABELS} submitCount={submitCount} focusSignal={focusSignal} fieldIds={FIELD_IDS} />}

        {/* ---------------------------------------------------- step 1 */}
        {current === "info" && (
          <>
            <Field id="email" label="Email" required hint="Your confirmation email will be sent here" error={errors.email?.message}>
              <input type="email" className="input" autoComplete="email" {...register("email")} />
            </Field>
            <section aria-labelledby="poster-h" className="space-y-2">
              <h3 id="poster-h" className="text-lg">EVENT POSTER</h3>
              <EventImage slot="poster" event={event} image={images.poster} onChanged={loadAll} className="mx-auto max-w-md" />
            </section>
            <section aria-labelledby="details-h" className="space-y-2">
              <h3 id="details-h" className="text-lg">EVENT DETAILS</h3>
              <EventImage slot="details_card" event={event} image={images.details_card} onChanged={loadAll} className="mx-auto max-w-md" />
              {event.kit_inclusions?.length > 0 && (
                <div className="rounded-lg bg-brand-ivory p-3 text-sm">
                  <p className="font-semibold">Kit inclusions</p>
                  <ul className="mt-1 list-disc pl-5">{event.kit_inclusions.map((k) => <li key={k}>{k}</li>)}</ul>
                </div>
              )}
            </section>
            <section aria-labelledby="terms-h" className="space-y-3">
              <h3 id="terms-h" className="text-lg">EVENT TERMS AND CONDITIONS</h3>
              <div className="rounded-lg border border-link bg-brand-ivory p-4 text-sm"><SafeHtml html={event.terms_html} />
                {contactLinkList(event.contact_links).length > 0 && (
                  <div className="mt-4"><p>If you have any concerns, please do not hesitate to contact us in any of our social media accounts!</p><ContactLinks links={event.contact_links} /></div>
                )}
              </div>
            </section>
            <fieldset>
              <legend className="label">Confirmation <span className="font-normal text-ink-muted">(required)</span></legend>
              <p className="hint mb-1">Check all that apply.</p>
              <div className="flex items-start gap-3">
                <input id="agree" type="checkbox" className="check mt-0.5" aria-required="true" aria-invalid={errors.agree ? "true" : undefined} aria-describedby={errors.agree ? "agree-err" : undefined} {...register("agree")} />
                <label htmlFor="agree" className="min-h-target py-2 text-base">I have read and agree to the Terms and Conditions</label>
              </div>
              {errors.agree && <p id="agree-err" className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{errors.agree.message}</p>}
            </fieldset>
          </>
        )}

        {/* ---------------------------------------------------- step 2 */}
        {current === "participant" && (
          <>
            <p className="text-sm text-ink-muted">In case of error/corrections, you may send it on confirmation email afterwards.</p>
            <Field id="name" label="Name" required hint="Please provide your name or nickname" error={errors.name?.message}><input className="input" autoComplete="name" {...register("name")} /></Field>
            <Field id="x_username" label="X/Twitter Username" required hint={'Please put your username without "@" sign'} error={errors.x_username?.message}>
              <input className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} {...register("x_username", { onBlur: (e) => setValue("x_username", normalizeX(e.target.value)) })} />
            </Field>
            <Field id="facebook_url" label="Facebook Profile Link" required hint="e.g fb.com/TeenfreshPH" error={errors.facebook_url?.message}><input className="input" inputMode="url" autoCapitalize="none" spellCheck={false} {...register("facebook_url")} /></Field>
            <Field id="contact_number" label="Contact Number" required hint="Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX" error={errors.contact_number?.message}><input type="tel" className="input" autoComplete="tel" {...register("contact_number")} /></Field>
            {privacy}
          </>
        )}

        {/* ---------------------------------------------------- kit (one per form) */}
        {current === "kit" && (
          <KitOrder kits={kits} register={register} errors={errors} kitId={kitId} order={order} />
        )}

        {/* ---------------------------------------------------- payment */}
        {current === "payment" && (
          <>
            <p className="text-sm text-ink-muted">For any other questions and concerns, you may send it on the confirmation email afterwards.</p>
            <section aria-labelledby="pm-h" className="rounded-lg border border-link bg-brand-ivory p-4">
              <h3 id="pm-h" className="text-lg">PAYMENT METHOD</h3>
              {event.payment_account_number || event.payment_account_name ? (
                <dl className="mt-2 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2"><dt className="font-semibold">G Cash:</dt><dd>{event.payment_account_name}</dd></div>
                  <div className="flex flex-wrap items-center gap-3"><dt className="font-semibold">Account number:</dt><dd className="font-mono text-lg font-bold">{event.payment_account_number}</dd>{event.payment_account_number && <dd><CopyButton text={event.payment_account_number} /></dd>}</div>
                  <div className="flex flex-wrap gap-2"><dt className="font-semibold">{kitMode ? "Amount to pay" : "Registration Fee"}:</dt><dd>{kitMode ? `${peso(total)}${order.kit ? ` (${order.kit.name})` : ""}` : `${fee}php (Exclusive of food and drinks)`}</dd></div>
                </dl>
              ) : <Alert tone="warn" className="mt-2">The payment details are not available yet. Please check back soon.</Alert>}
              <p className="mt-3 text-sm">Kindly avoid using the &quot;Money Protect&quot; feature to avoid inconveniences and cancellation of your slot.</p>
            </section>
            <section aria-labelledby="qr-h" className="space-y-2">
              <h3 id="qr-h" className="text-lg">QR CODE</h3>
              <EventImage slot="gcash_qr" event={event} image={images.gcash_qr} onChanged={loadAll} className="mx-auto max-w-[16rem]" />
              <p className="text-center text-sm text-ink-muted">Transfer fees may apply.</p>
            </section>

            {reusable.length > 0 && (
              <div>
                <label htmlFor="reuse" className="label">Use the payment details from one of my earlier forms</label>
                <select id="reuse" className="input" value={reuseId || ""} onChange={(e) => chooseReuse(e.target.value)} aria-describedby="reuse-hint">
                  <option value="">No, I made a new payment</option>
                  {reusable.map((p) => <option key={p.id} value={p.id}>{p.sender_name}, {peso(p.amount_paid)}, ref …{p.reference_number.slice(-4)} ({peso(balanceLeft(p))} left)</option>)}
                </select>
                <p id="reuse-hint" className="hint">A payment can cover several forms until its balance is used up. This form costs {peso(total)}. Choosing one fills in and locks the fields below.</p>
              </div>
            )}

            <Field id="sender_name" label="Name of Sender" required error={errors.sender_name?.message}><input className="input" readOnly={!!reuseId} {...register("sender_name")} /></Field>
            <Field id="amount_paid" label="Amount Paid" required hint={`At least ${peso(total)}${kitMode && order.kit ? ` (${order.kit.name})` : ""}. Convenience or transaction fees are not covered. Send enough so that the kit price is complete.`} error={errors.amount_paid?.message}>
              <input className="input" inputMode="decimal" readOnly={!!reuseId} {...register("amount_paid")} />
            </Field>
            <Field id="reference_number" label="Reference Number" required hint="Type it exactly as your banking app shows it" error={errors.reference_number?.message}>
              <input className="input" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={80} readOnly={!!reuseId} {...register("reference_number")} />
            </Field>

            {reuseId ? (
              <div className="rounded-lg border border-link p-3 text-sm"><p className="font-semibold">Payment receipt</p><p>Already submitted with your earlier form. No new file is needed.</p></div>
            ) : (
              <FileUpload id="receipt" file={file} onChange={(f) => { setFile(f); setReceiptError(""); }} error={receiptError} />
            )}

            <Field id="notes" label="Notes (optional)" hint={`${notesLength} of 500 characters`} error={errors.notes?.message}>
              <textarea className="input" rows={3} maxLength={500} {...register("notes")} />
            </Field>
            {privacy}
          </>
        )}

        {/* ---------------------------------------------------- step 4 */}
        {current === "review" && (
          <>
            <p className="text-ink-muted">Check your details. Your ticket and confirmation email use exactly this information.</p>
            {reviewSections.map(([key, title, rows]) => (
              <section key={key} aria-label={title} className="rounded-lg border border-link p-3">
                <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-lg">{title}</h3><button type="button" className="btn-secondary" onClick={() => go(key)}><IconPencil />Edit{" "}<span className="sr-only">{title}</span></button></div>
                <dl className="space-y-1 text-sm">{rows.map(([k, val]) => <div key={k} className="flex flex-wrap justify-between gap-2"><dt className="font-semibold">{k}</dt><dd className="break-all text-right">{val}</dd></div>)}</dl>
              </section>
            ))}
            {paid && !reusedPayment && file && <ReceiptPreview file={file} />}
            {paid && !reusedPayment && !file && <Alert tone="bad">Your receipt is missing (it is not saved if the page reloads). <button type="button" className="underline" onClick={() => go("payment")}>Attach it again</button>.</Alert>}
            {serverError && <Alert tone="bad">{serverError}</Alert>}
          </>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t border-brand-sky pt-4">
          {stepIndex > 0 ? <button type="button" className="btn-secondary" onClick={back} disabled={submitting}><IconArrowLeft />Back</button> : <span />}
          {current === "review"
            ? <button type="button" className="btn-primary" onClick={submitAll} disabled={submitting || (paid && !reusedPayment && !file)}><IconSend />{submitting ? "Submitting…" : "Submit registration"}</button>
            : <button type="button" className="btn-primary" onClick={onNext}><IconArrowRight />{current === steps[steps.length - 2].key ? "Review registration" : "Next"}</button>}
        </div>
      </form>
    </div>
  );
}

function ReceiptPreview({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { if (!file.type.startsWith("image/")) return undefined; const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  if (!url) return <p className="text-sm text-ink-muted">Receipt: {file.name} (PDF, no preview).</p>;
  return <figure><img src={url} alt={`Preview of your receipt, ${file.name}`} className="mx-auto max-h-72 rounded-lg border border-link" /><figcaption className="mt-1 text-center text-sm text-ink-muted">Receipt preview</figcaption></figure>;
}
