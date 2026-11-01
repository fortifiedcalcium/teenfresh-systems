import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { callFunction, fetchAll, friendlyError, resendMany } from "../../lib/api.js";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import { downloadCsv } from "../../lib/csv.js";
import DataTable from "../../components/DataTable.jsx";
import { useMediaQuery } from "../../hooks/useBreakpoint.js";
import { MEDIA } from "../../lib/breakpoints.js";
import FilterBar from "../../components/FilterBar.jsx";
import TopBarAction from "../../components/admin/TopBarAction.jsx";
import Modal from "../../components/Modal.jsx";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import Field from "../../components/Field.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { Lightbox } from "../../components/EventImage.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { useToast } from "../../components/Toast.jsx";
import { IconAlert, IconCheckCircle, IconClose, IconDownload, IconEye, IconSend, IconWallet, IconXCircle } from "../../components/NavIcons.jsx";

const TONE = { pending: "warn", verified: "ok", underpaid: "warn", rejected: "bad" };
const LABEL = { pending: "Pending", verified: "Verified", underpaid: "Underpaid", rejected: "Rejected" };
const activeForms = (p) => (p.registrations || []).filter((r) => r.status === "pending_verification" || r.status === "confirmed");
/** what the forms on a payment add up to (quantity x price of each ordered kit), in pesos */
const expectedOf = (p) => Math.round(activeForms(p).reduce((a, r) => a + Math.round(Number(r.total_amount || 0) * 100), 0)) / 100;

/** A receipt from the private bucket, shown through a short-lived signed URL */
function Receipt({ path, label }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("payment-receipts").createSignedUrl(path, 300).then(({ data, error }) => { if (!alive) return; if (error) setErr("Could not open this receipt."); else setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [path]);
  const isPdf = /\.pdf$/i.test(path);
  if (err) return <p className="text-sm font-semibold text-danger">{err}</p>;
  if (!url) return <Loading label="Loading receipt…" className="p-4" />;
  return (
    <figure className="space-y-2">
      {isPdf ? <p className="rounded-lg bg-brand-sky p-4 text-sm font-semibold">PDF receipt: open it in a new tab to read it.</p>
        : <button type="button" className="block w-full" onClick={() => setZoom(true)} aria-label={`Zoom in: ${label}`}><img src={url} alt={label} className="mx-auto max-h-96 rounded-lg border border-link object-contain" /></button>}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{label}</span><a href={url} target="_blank" rel="noopener noreferrer">Open in a new tab{" "}<span className="sr-only">(link expires in 5 minutes)</span></a></figcaption>
      {zoom && <Lightbox url={url} alt={label} title="Payment receipt" onClose={() => setZoom(false)} />}
    </figure>
  );
}

/** The review opens as a dialog (a full-screen sheet on phones). From 768px it is shown beside the list instead (master-detail). */
function Shell({ inline, title, onClose, children }) {
  if (!inline) return <Modal title={title} onClose={onClose} wide>{children}</Modal>;
  return (
    <section aria-label={title} className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-2"><h2 className="text-lg font-bold">{title}</h2><button type="button" className="btn-secondary" onClick={onClose} aria-label="Close review"><IconClose /></button></div>
      {children}
    </section>
  );
}

function ReviewDialog({ payment, onClose, onChanged, inline = false }) {
  const toast = useToast();
  const forms = activeForms(payment);
  const expected = expectedOf(payment);
  const paid = Number(payment.amount_paid);
  const short = paid < expected;
  const [action, setAction] = useState(null);       // null | verified | underpaid | rejected
  const [reason, setReason] = useState("");
  const [due, setDue] = useState(short ? String(Math.max(expected - paid, 0).toFixed(2)) : "");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState([]);
  const reviewable = payment.status === "pending" || payment.status === "underpaid";

  useEffect(() => {
    supabase.from("payments").select("id,event_id").eq("reference_number", payment.reference_number).neq("id", payment.id)
      .then(({ data }) => setDupes(data || []));
  }, [payment]);

  const decide = async () => {
    setError("");
    if (action === "rejected" && !reason.trim()) return setError("Give a reason. It is emailed to the person.");
    if (action === "underpaid" && !(Number(due) > 0)) return setError("Enter the remaining amount due.");
    if (action === "verified" && short && (!override || !reason.trim())) return setError("The amount is below the fee. Tick “Verify anyway” and give a reason to override.");
    setBusy(true);
    const { data, error: err } = await supabase.rpc("review_payment", { p_payment_id: payment.id, p_decision: action, p_reason: reason.trim() || null, p_override: override, p_amount_due: action === "underpaid" ? Number(due) : null });
    if (err) { setBusy(false); return setError(friendlyError(err)); }
    // The decision is saved. Now the email(s); a failure here does not undo the decision (see Email logs to resend).
    let sent = 0, failed = 0;
    try {
      if (action === "verified") ({ sent, failed } = await resendMany(data.registration_ids));
      else { const r = await callFunction("send-payment-email", { kind: action === "underpaid" ? "payment_underpaid" : "payment_rejected", payment_id: payment.id }); r.results.forEach((x) => (x.status === "sent" ? sent++ : failed++)); }
    } catch (e) { failed = Math.max(forms.length, 1); }
    setBusy(false);
    toast(failed ? `Saved. ${failed} email(s) did not send: use Resend.` : `Payment ${LABEL[action].toLowerCase()}. ${sent} email(s) sent.`, failed ? "error" : "success");
    onChanged();
  };

  const resendNotice = async () => {
    setBusy(true);
    try {
      if (payment.status === "verified") await resendMany(forms.map((f) => f.id));
      else await callFunction("send-payment-email", { kind: payment.status === "underpaid" ? "payment_underpaid" : "payment_rejected", payment_id: payment.id });
      toast("Email sent", "success");
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  return (
    <Shell inline={inline} title={`Payment of ${peso(paid)} from ${payment.sender_name}`} onClose={onClose}>
      <div className={`grid gap-5 ${inline ? "" : "lg:grid-cols-2"}`}>
        <section aria-labelledby="rcpt-h" className="space-y-3">
          <h3 id="rcpt-h" className="text-lg">Receipt</h3>
          {payment.receipt_path ? <Receipt path={payment.receipt_path} label={`GCash receipt, reference ${payment.reference_number}`} /> : <Alert tone="warn">The receipt file was deleted{payment.receipt_deleted_at ? ` on ${fmtDateTime(payment.receipt_deleted_at)}` : ""}.</Alert>}
          {payment.receipt_history?.length > 0 && <details><summary className="min-h-target cursor-pointer py-2 font-semibold">Earlier receipts ({payment.receipt_history.length})</summary><div className="space-y-4">{payment.receipt_history.map((p, i) => <Receipt key={p} path={p} label={`Earlier receipt ${i + 1}, reference ${payment.reference_history?.[i] || "unknown"}`} />)}</div></details>}
        </section>

        <section aria-labelledby="det-h" className="space-y-3">
          <h3 id="det-h" className="text-lg">Details</h3>
          <dl className="space-y-1 text-sm">
            {[["Status", <Badge key="s" tone={TONE[payment.status]}>{LABEL[payment.status]}</Badge>], ["Sender", payment.sender_name], ["Submitted by", payment.sender_profile ? `${payment.sender_profile.full_name || ""} ${payment.sender_profile.email}` : "—"],
              ["Amount paid", peso(paid)], [`Expected (${forms.length} form${forms.length === 1 ? "" : "s"})`, peso(expected)], ["Reference", <span key="r" className="font-mono">{payment.reference_number}</span>], ["Submitted", fmtDateTime(payment.created_at)],
              ...(payment.amount_due ? [["Amount due", peso(payment.amount_due)]] : []), ...(payment.review_note ? [["Note", payment.review_note]] : []), ...(payment.resubmission_count ? [["Resubmitted", `${payment.resubmission_count} time(s)`]] : [])]
              .map(([k, v]) => <div key={k} className="flex flex-wrap justify-between gap-2"><dt className="font-semibold">{k}</dt><dd className="text-right">{v}</dd></div>)}
          </dl>
          <div><p className="font-semibold">Linked forms</p>
            <ul className="mt-1 space-y-1 text-sm">{(payment.registrations || []).map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-brand-sky p-2"><span>{r.name} <span className="text-ink-muted">@{r.x_username}</span>{r.kit_name && <span className="block text-ink-muted">{r.kit_name} × {r.kit_quantity} = {peso(r.total_amount)}</span>}{r.facebook_url && <> · <a href={r.facebook_url} target="_blank" rel="noopener noreferrer">Facebook{" "}<span className="sr-only">of {r.name} (opens in a new tab)</span></a></>}</span><span className="flex gap-2"><Badge tone={r.status === "confirmed" ? "ok" : r.status === "pending_verification" ? "warn" : "bad"}>{r.status.replace("_", " ")}</Badge>{r.ticket_number && <span className="font-mono">{r.ticket_number}</span>}</span></li>)}</ul>
          </div>
          {short && reviewable && <Alert tone="warn">The amount paid ({peso(paid)}) is lower than expected ({peso(expected)}). Convenience or transaction fees are not covered by the kit price.</Alert>}
          {paid > expected && expected > 0 && <Alert tone="info">The amount is higher than expected ({peso(expected)}). It may cover more forms the person has not submitted yet.</Alert>}
          {dupes.length > 0 && <Alert tone="bad">This reference number also appears on {dupes.length} other payment(s). Check that the receipt is not reused.</Alert>}
        </section>
      </div>

      {reviewable && !action && (
        <div className="sheet-actions mt-5 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setAction("verified")}><IconCheckCircle />Verify payment</button>
          <button className="btn-secondary" onClick={() => setAction("underpaid")}><IconAlert />Mark underpaid</button>
          <button className="btn-danger" onClick={() => setAction("rejected")}><IconXCircle />Reject payment</button>
        </div>
      )}
      {!reviewable && <div className="mt-5 border-t border-brand-sky pt-4"><button className="btn-secondary" onClick={resendNotice} disabled={busy}><IconSend />Resend the email for this decision</button></div>}

      {action && (
        <ConfirmDialog
          title={action === "verified" ? "Verify this payment?" : action === "underpaid" ? "Mark this payment as underpaid?" : "Reject this payment?"}
          tone={action === "rejected" ? "danger" : "primary"} confirmLabel={action === "verified" ? "Verify and send tickets" : action === "underpaid" ? "Mark underpaid and email" : "Reject and email"}
          busy={busy} onCancel={() => { setAction(null); setError(""); }} onConfirm={decide}>
          <div className="space-y-3">
            {action === "verified" && <p>{forms.length} form(s) will be confirmed, get ticket numbers and receive the confirmation email.</p>}
            {action === "underpaid" && <><p>The forms stay pending and keep their slots. The person is emailed the amount due and can resubmit.</p><Field id="due" label="Amount still due (PHP)" required><input className="input" inputMode="decimal" value={due} onChange={(e) => setDue(e.target.value)} /></Field></>}
            {action === "rejected" && <p>The forms are rejected and their slots are released. The person is emailed the reason and can resubmit.</p>}
            {action === "verified" && short && <label className="flex items-start gap-3"><input type="checkbox" className="check" checked={override} onChange={(e) => setOverride(e.target.checked)} /><span className="py-1">Verify anyway: the amount paid is below {peso(expected)}</span></label>}
            {(action !== "verified" || (short && override)) && <Field id="reason" label={action === "rejected" ? "Reason (emailed to the person)" : action === "underpaid" ? "Note to the person (optional)" : "Reason for the override"} required={action === "rejected" || action === "verified"}><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
            {error && <Alert tone="bad">{error}</Alert>}
          </div>
        </ConfirmDialog>
      )}
    </Shell>
  );
}

export default function Payments() {
  const { event } = useOutletContext();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const split = useMediaQuery(MEDIA.fromTablet);   // 768 and up: list on the left (40%), review on the right (60%)

  const load = useCallback(async () => {
    if (!event) return;
    const data = await fetchAll(() => supabase.from("payments")
      .select("*, sender_profile:profiles!payments_user_id_fkey(email,full_name), registrations(id,name,x_username,facebook_url,status,ticket_number,kit_name,kit_quantity,total_amount)")
      .eq("event_id", event.id).order("created_at").order("id"));
    setRows(data);
    setSel((s) => (s ? data.find((p) => p.id === s.id) || null : s));
  }, [event]);

  useEffect(() => {
    setRows(null); load();
    if (!event) return undefined;
    const ch = supabase.channel("pay-" + event.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `event_id=eq.${event.id}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [event, load]);

  const shown = useMemo(() => (rows || []).filter((p) => (!status || p.status === status)
    && (!q || `${p.sender_name} ${p.reference_number} ${(p.registrations || []).map((r) => `${r.name} ${r.x_username}`).join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [rows, status, q]);
  const counts = useMemo(() => Object.fromEntries(["pending", "underpaid", "verified", "rejected"].map((s) => [s, (rows || []).filter((p) => p.status === s).length])), [rows]);

  if (!event) return <Empty>Create an event first.</Empty>;
  const cols = [
    { key: "sender_name", label: "Sender", render: (p) => <>{p.sender_name}<br /><span className="text-xs font-normal text-ink-muted">{p.sender_profile?.email}</span></> },
    { key: "amount_paid", label: "Paid / expected", sortValue: (p) => Number(p.amount_paid), render: (p) => { const exp = expectedOf(p); return <span className={Number(p.amount_paid) < exp ? "font-bold text-danger" : ""}>{peso(p.amount_paid)} / {peso(exp)}{Number(p.amount_paid) < exp ? " (short)" : ""}</span>; } },
    { key: "reference_number", label: "Reference", className: "font-mono" },
    { key: "forms", label: "Forms", sortValue: (p) => (p.registrations || []).length, render: (p) => <ul>{(p.registrations || []).map((r) => <li key={r.id}>{r.name} <span className="text-ink-muted">@{r.x_username}</span></li>)}</ul> },
    { key: "created_at", label: "Submitted", className: "whitespace-nowrap", render: (p) => fmtDateTime(p.created_at) },
    { key: "status", label: "Status", render: (p) => <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge> },
    { key: "act", label: "", sortable: false, render: (p) => <button className="btn-primary" onClick={() => setSel(p)}><IconEye />{p.status === "pending" || p.status === "underpaid" ? "Review" : "View"}{" "}<span className="sr-only">payment of {p.sender_name}</span></button> },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl"><IconWallet />Payments</h1>
        <TopBarAction icon={IconDownload} label="Export CSV" short="Export" disabled={!shown.length} onClick={() => downloadCsv(`payments-${event.ticket_prefix}.csv`, ["Sender", "Email", "Amount paid", "Reference", "Status", "Forms", "Submitted"], shown.map((p) => [p.sender_name, p.sender_profile?.email, p.amount_paid, p.reference_number, p.status, (p.registrations || []).map((r) => `${r.name} (@${r.x_username})`).join("; "), fmtDateTime(p.created_at)]))} />
      </div>
      <FilterBar activeCount={status !== "pending" ? 1 : 0}
        search={<input className="input w-full md:w-72" placeholder="Search sender, reference, name" aria-label="Search payments" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <select className="input max-w-[14rem]" aria-label="Payment status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending ({counts.pending})</option><option value="underpaid">Underpaid ({counts.underpaid})</option><option value="verified">Verified ({counts.verified})</option><option value="rejected">Rejected ({counts.rejected})</option><option value="">All</option>
        </select>
      </FilterBar>
      <p role="status" className="text-sm font-semibold">{rows ? `${shown.length} payment${shown.length === 1 ? "" : "s"} found` : "Loading payments…"}</p>
      <div className={split && sel ? "grid items-start gap-4 md:grid-cols-5" : ""}>
        <div className="min-w-0 md:col-span-2">
          <DataTable caption="Payments" columns={cols} rows={shown} loading={rows === null} cards={split && !!sel} empty={status === "pending" ? "No payments are waiting for review." : "No payments match."} initialSort={{ key: "created_at", dir: "asc" }} />
        </div>
        {sel && split && <div className="min-w-0 md:sticky md:top-4 md:col-span-3"><ReviewDialog key={sel.id} inline payment={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} /></div>}
      </div>
      {sel && !split && <ReviewDialog payment={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} />}
    </div>
  );
}
