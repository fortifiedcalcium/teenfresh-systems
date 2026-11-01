import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabaseClient.js";
import { friendlyError } from "../../lib/api.js";
import { makeStep3Schema } from "../../lib/validation.js";
import { parseAmount, peso, receiptPath, validateReceiptFile } from "../../lib/payment.js";
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
import { IconClose, IconSend, IconTicket, IconUpload } from "../../components/NavIcons.jsx";

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
  const [file, setFile] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusSignal, bumpFocus] = useErrorFocus();
  const { register, handleSubmit, formState: { errors, submitCount } } = useForm({
    shouldFocusError: false,
    defaultValues: { reuse_payment_id: "", sender_name: pay.sender_name || "", amount_paid: "", reference_number: "", notes: "" },
    resolver: zodResolver(makeStep3Schema(payTotal)),
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
          ? <Alert tone="warn">Remaining amount due: <strong>{peso(pay.amount_due)}</strong>. {pay.review_note} Send it by GCash, then enter the <strong>total you have paid</strong> (including the first payment) and attach the new receipt.</Alert>
          : <Alert tone="bad">Your payment was not verified. Reason: <strong>{pay.review_note}</strong>. Attach a correct receipt and enter the details of the payment.</Alert>}
        <p className="text-sm text-ink-muted">The total must be at least {peso(payTotal)}, what the form{reg.formsOnPayment === 1 ? "" : "s"} on this payment add{reg.formsOnPayment === 1 ? "s" : ""} up to.</p>
        <ErrorSummary errors={{ ...errors, ...(receiptError ? { receipt: { message: receiptError } } : {}) }} labels={{ sender_name: "Name of sender", amount_paid: "Total amount paid", reference_number: "Reference number", receipt: "Payment receipt" }} submitCount={submitCount} focusSignal={focusSignal} fieldIds={{ receipt: "resub-receipt" }} />
        <Field id="resub-sender" label="Name of Sender" required error={errors.sender_name?.message}><input className="input" {...register("sender_name")} /></Field>
        <Field id="resub-amount" label="Total Amount Paid" required error={errors.amount_paid?.message}><input className="input" inputMode="decimal" {...register("amount_paid")} /></Field>
        <Field id="resub-ref" label="Reference Number (of the new transfer)" required hint="Digits only" error={errors.reference_number?.message}><input className="input" inputMode="numeric" autoComplete="off" {...register("reference_number")} /></Field>
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

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("registrations")
      .select("*, events(title,event_date,venue,registration_fee), payments(id,status,review_note,amount_due,amount_paid,reference_number,sender_name)")
      // "My" registrations: ask for my own rows explicitly. The database already hides other people's rows from attendees, but
      // admins are allowed to read everything, so without this filter an admin saw every user's registrations on this page.
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (e) setError("Could not load your registrations.");
    const list = data || [];
    // how many of my forms share each payment (the resubmit minimum is fee x forms)
    const count = {}, sum = {};
    list.forEach((r) => { if (r.payment_id && r.status !== "cancelled") { count[r.payment_id] = (count[r.payment_id] || 0) + 1; sum[r.payment_id] = Math.round(((sum[r.payment_id] || 0) + Number(r.total_amount || 0)) * 100) / 100; } });
    setRows(list.map((r) => ({ ...r, formsOnPayment: count[r.payment_id] || 1, payTotal: sum[r.payment_id] || 0 })));
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <Loading label="Loading your registrations…" className="p-12" />;
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-2xl"><IconTicket />My registrations</h1>
      {error && <Alert tone="bad" className="mb-3">{error}</Alert>}
      {rows.length === 0 ? <Empty>You haven&apos;t registered for any event yet. <Link to="/">Browse events</Link></Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const s = STATUS[r.status];
            const p = r.payments;
            const needsAction = p && (p.status === "underpaid" || p.status === "rejected");
            return (
              <li key={r.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{r.events?.title}</h2>
                    <p className="text-sm text-ink-muted">{fmtDateTime(r.events?.event_date)} · {r.events?.venue}</p>
                    <p className="text-sm">For <strong>{r.name}</strong> (@{r.x_username})</p>
                    {r.kit_name && <p className="text-sm">{r.kit_name} × {r.kit_quantity}{Number(r.total_amount) > 0 ? ` · ${peso(r.total_amount)}` : ""}</p>}
                    {r.ticket_number && r.status === "confirmed" && <p className="mt-1 font-mono text-sm">{r.ticket_number}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {r.status === "confirmed" && <Link className="btn-primary" to={`/my-ticket/${r.id}`} aria-label={`View ticket ${r.ticket_number} for ${r.events?.title}`}><IconTicket />View ticket</Link>}
                  </div>
                </div>
                {r.status === "pending_verification" && !needsAction && <p className="text-sm text-ink-muted">Your payment is being verified. A confirmation email will be sent within 48 to 72 hours.</p>}
                {needsAction && (
                  <Alert tone={p.status === "underpaid" ? "warn" : "bad"}>
                    <p className="font-semibold">{p.status === "underpaid" ? `Payment incomplete: ${peso(p.amount_due)} still due.` : "Payment rejected."}</p>
                    {p.review_note && <p>{p.review_note}</p>}
                    <button className="btn-primary mt-2" onClick={() => setResubmit(r)}><IconUpload />{p.status === "underpaid" ? "Send the missing amount" : "Upload a new receipt"}{" "}<span className="sr-only">for {r.name}</span></button>
                  </Alert>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {resubmit && <ResubmitDialog reg={resubmit} onClose={() => setResubmit(null)} onDone={() => { setResubmit(null); load(); }} />}
    </div>
  );
}
