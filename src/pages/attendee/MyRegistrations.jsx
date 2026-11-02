import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabaseClient.js";
import { friendlyError } from "../../lib/api.js";
import { makeStep3Schema } from "../../lib/validation.js";
import { kitLabel, parseAmount, peso, receiptPath, validateReceiptFile } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import Field from "../../components/Field.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import FileUpload from "../../components/FileUpload.jsx";
import Modal from "../../components/Modal.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import CopyButton from "../../components/CopyButton.jsx";
import EventImage from "../../components/EventImage.jsx";
import { Ticket, TicketBarcode, TicketStub } from "../../components/Ticket.jsx";
import { IconCalendar, IconClose, IconMapPin, IconPackage, IconSend, IconTicket, IconUpload, IconUser } from "../../components/NavIcons.jsx";

const STATUS = {
  pending_verification: { tone: "warn", label: "Pending verification" },
  confirmed: { tone: "ok", label: "Confirmed" },
  rejected: { tone: "bad", label: "Rejected" },
  cancelled: { tone: "bad", label: "Cancelled" },
};

/** Fix an underpaid or rejected payment: new receipt, reference number and (total) amount. */
function ResubmitDialog({ reg, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const pay = reg.payments;
  const payTotal = reg.payTotal || Number(reg.events?.registration_fee || 0);   // what the forms on this payment add up to
  const underpaid = pay.status === "underpaid";
  const paidSoFar = Number(pay.amount_paid || 0);
  // Underpaid: only the missing amount is sent now (and added to what was paid before). Rejected: a full payment again.
  const missing = underpaid ? Math.max(Number(pay.amount_due ?? payTotal - paidSoFar), 0) : 0;
  const minAmount = underpaid ? Math.max(missing, 0.01) : payTotal;
  const [file, setFile] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusSignal, bumpFocus] = useErrorFocus();
  const { register, handleSubmit, formState: { errors, submitCount } } = useForm({
    shouldFocusError: false,
    defaultValues: { reuse_payment_id: "", sender_name: pay.sender_name || "", amount_paid: underpaid ? missing.toFixed(2) : "", reference_number: "", notes: "" },
    resolver: zodResolver(makeStep3Schema(minAmount)),
  });

  const submit = handleSubmit(async (v) => {
    const problem = validateReceiptFile(file);
    setReceiptError(problem || "");
    if (problem) { bumpFocus(); return; }
    setBusy(true); setServerError("");
    const path = receiptPath(user.id, file);
    const up = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); setServerError("We couldn't upload your receipt. Try again."); return; }
    const { error } = await supabase.rpc("resubmit_payment", { p_payment_id: pay.id, p_sender_name: v.sender_name, p_amount: parseAmount(v.amount_paid), p_reference: v.reference_number, p_receipt_path: path });
    setBusy(false);
    if (error) { setServerError(friendlyError(error)); return; }
    toast("Payment sent for review again.", "success");
    onDone();
  }, () => { setReceiptError(validateReceiptFile(file) || ""); bumpFocus(); });

  return (
    <Modal title={pay.status === "underpaid" ? "Send the missing amount" : "Resubmit your payment"} onClose={onClose} wide>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4" noValidate>
        {pay.status === "underpaid"
          ? <Alert tone="warn">You have paid {peso(paidSoFar)} of {peso(payTotal)}. <strong>Send only the missing {peso(missing)}</strong> by GCash. You do not need to pay the full amount again. {pay.review_note} Then enter the amount you just sent and the reference number of that transfer, and attach its receipt.</Alert>
          : <Alert tone="bad">Your payment was not verified. Reason: <strong>{pay.review_note}</strong>. Attach a correct receipt and enter the details of the payment.</Alert>}
        <p className="text-sm text-ink-muted">{underpaid
          ? <>Send at least {peso(missing)}. It is added to the {peso(paidSoFar)} you already paid, so your total becomes at least {peso(paidSoFar + missing)}.</>
          : <>The total must be at least {peso(payTotal)}, what the form{reg.formsOnPayment === 1 ? "" : "s"} on this payment add{reg.formsOnPayment === 1 ? "s" : ""} up to.</>}</p>
        <ErrorSummary errors={{ ...errors, ...(receiptError ? { receipt: { message: receiptError } } : {}) }} labels={{ sender_name: "Name of sender", amount_paid: underpaid ? "Amount you are sending now" : "Total amount paid", reference_number: "Reference number", receipt: "Payment receipt" }} submitCount={submitCount} focusSignal={focusSignal} fieldIds={{ receipt: "resub-receipt" }} />
        <Field id="resub-sender" label="Name of Sender" required error={errors.sender_name?.message}><input className="input" {...register("sender_name")} /></Field>
        <Field id="resub-amount" label={underpaid ? "Amount You Are Sending Now" : "Total Amount Paid"} required hint={underpaid ? `At least ${peso(missing)}` : undefined} error={errors.amount_paid?.message}><input className="input" inputMode="decimal" {...register("amount_paid")} /></Field>
        <Field id="resub-ref" label="Reference Number (of the new transfer)" required hint="Type it exactly as your banking app shows it" error={errors.reference_number?.message}><input className="input" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={80} {...register("reference_number")} /></Field>
        <FileUpload id="resub-receipt" file={file} onChange={(f) => { setFile(f); setReceiptError(""); }} error={receiptError} />
        {serverError && <Alert tone="bad">{serverError}</Alert>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}><IconClose />Cancel</button><button type="button" className="btn-primary" onClick={submit} disabled={busy}><IconSend />{busy ? "Sending…" : "Send for review"}</button></div>
      </form>
    </Modal>
  );
}

export default function MyRegistrations() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [resubmit, setResubmit] = useState(null);
  const [banners, setBanners] = useState({});

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("registrations")
      .select("*, events(title,event_date,venue,registration_fee,banner_coming_soon), payments(id,status,review_note,amount_due,amount_paid,reference_number,sender_name)")
      // "My" registrations: ask for my own rows explicitly. The database already hides other people's rows from attendees, but
      // admins are allowed to read everything, so without this filter an admin saw every user's registrations on this page.
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (e) setError("Could not load your registrations.");
    const im = await supabase.from("event_images").select("*").eq("slot", "banner");          // the same banners the home page shows
    setBanners(Object.fromEntries((im.data || []).map((x) => [x.event_id, x])));
    const list = data || [];
    // how many of my forms share each payment (the resubmit minimum is fee x forms)
    const count = {}, sum = {};
    list.forEach((r) => { if (r.payment_id && r.status !== "cancelled") { count[r.payment_id] = (count[r.payment_id] || 0) + 1; sum[r.payment_id] = Math.round(((sum[r.payment_id] || 0) + Number(r.total_amount || 0)) * 100) / 100; } });
    setRows(list.map((r) => ({ ...r, formsOnPayment: count[r.payment_id] || 1, payTotal: sum[r.payment_id] || 0 })));
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <Loading label="Loading your registrations…" className="p-12" logo />;
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-2xl"><IconTicket />My registrations</h1>
      {error && <Alert tone="bad" className="mb-3">{error}</Alert>}
      {rows.length === 0 ? <Empty>You haven&apos;t registered for any event yet. <Link to="/">Browse events</Link></Empty> : (
        <ul className="ticket-grid 2xl:-mx-32 pb-[env(safe-area-inset-bottom)]">
          {rows.map((r) => {
            const s = STATUS[r.status];
            const p = r.payments;
            const needsAction = p && (p.status === "underpaid" || p.status === "rejected");
            const ev = r.events;
            // what kind of ticket this is: it decides the stub (confirmed: number + View ticket; pending: waiting; needs action: message + button)
            const kind = r.status === "cancelled" ? "cancelled" : needsAction ? (r.status === "rejected" ? "rejected" : "attention") : r.status === "confirmed" ? "confirmed" : "pending";
            const titleId = `reg-title-${r.id}`;
            return (
              <li key={r.id} className="ticket-li">
                <Ticket
                  status={kind}
                  labelledBy={titleId}
                  image={<EventImage slot="banner" event={{ id: r.event_id, title: ev?.title, banner_coming_soon: ev?.banner_coming_soon }} image={banners[r.event_id]} lightbox={false} fit="cover" className="!rounded-none !border-0" />}
                  stub={
                    kind === "confirmed" ? (
                      <TicketStub label="Ticket no.">
                        {r.ticket_number && (
                          <div className="flex items-center justify-between gap-2">
                            <p className="ticket__number">{r.ticket_number}</p>
                            <CopyButton iconOnly text={r.ticket_number} label="Copy ticket number" what="Ticket number" />
                          </div>
                        )}
                        <TicketBarcode value={r.ticket_number || r.id} />
                        <Link className="btn-primary w-full" to={`/my-ticket/${r.id}`} aria-label={`View ticket ${r.ticket_number} for ${ev?.title}`}><IconTicket />View ticket</Link>
                      </TicketStub>
                    ) : kind === "pending" ? (
                      <TicketStub label="Awaiting payment check">
                        <p className="text-sm text-ink">Your payment is being verified. A confirmation email will be sent within 48 to 72 hours.</p>
                      </TicketStub>
                    ) : kind === "cancelled" ? (
                      <TicketStub label="Cancelled">
                        <p className="text-sm text-ink">This registration was cancelled. There is nothing more to do.</p>
                      </TicketStub>
                    ) : (
                      <TicketStub label="Action needed">
                        <Alert tone={p.status === "underpaid" ? "warn" : "bad"} className="border-l-4">
                          <p className="font-semibold">{p.status === "underpaid" ? `Payment incomplete: ${peso(p.amount_due)} still due.` : "Payment rejected."}</p>
                          {p.review_note && <p>{p.review_note}</p>}
                        </Alert>
                        <button className="btn-primary w-full" onClick={() => setResubmit(r)}><IconUpload />{p.status === "underpaid" ? "Send the missing amount" : "Upload a new receipt"}{" "}<span className="sr-only">for {r.name}</span></button>
                      </TicketStub>
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 id={titleId} className="line-clamp-2 min-w-0 flex-1 text-lg font-black leading-snug" title={ev?.title}>{ev?.title}</h2>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <dl className="space-y-1 text-sm text-ink-muted">
                    <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconCalendar />Date:</dt><dd>{fmtDateTime(ev?.event_date)}</dd></div>
                    {ev?.venue && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconMapPin />Venue:</dt><dd className="line-clamp-2" title={ev.venue}>{ev.venue}</dd></div>}
                    <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconUser />For:</dt><dd className="min-w-0 break-words text-ink">{r.name} (@{r.x_username})</dd></div>
                    {r.kit_name && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconPackage />Kit:</dt><dd>{`${kitLabel(r.kit_name, r.kit_quantity)}${Number(r.total_amount) > 0 ? ` · ${peso(r.total_amount)}` : ""}`}</dd></div>}
                  </dl>
                </Ticket>
              </li>
            );
          })}
        </ul>
      )}
      {resubmit && <ResubmitDialog reg={resubmit} onClose={() => setResubmit(null)} onDone={() => { setResubmit(null); load(); }} />}
    </div>
  );
}
