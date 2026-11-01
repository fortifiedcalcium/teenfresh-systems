import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { callFunction, fetchAll, resendMany } from "../../lib/api.js";
import { exportReport } from "../../lib/excel.js";
import { normalizeFacebook, normalizePhone, normalizeX } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import { peso } from "../../lib/payment.js";
import { useToast } from "../../components/Toast.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import Field from "../../components/Field.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { Empty } from "../../components/Spinner.jsx";
import { IconClose, IconDownload, IconEye, IconPencil, IconSave, IconSend, IconTrash, IconUndo, IconUserCheck, IconUserX, IconUsers, IconXCircle } from "../../components/NavIcons.jsx";
import FilterBar from "../../components/FilterBar.jsx";
import TopBarAction from "../../components/admin/TopBarAction.jsx";

const EMAIL_BADGE = { sent: "badge-ok", failed: "badge-bad", none: "badge-neutral" };
const STATUS_BADGE = { pending_verification: ["badge-warn", "pending verification"], confirmed: ["badge-ok", "confirmed"], rejected: ["badge-bad", "rejected"], cancelled: ["badge-bad", "cancelled"] };
const PAY_BADGE = { pending: "badge-warn", verified: "badge-ok", underpaid: "badge-warn", rejected: "badge-bad", none: "badge-neutral" };

export default function Attendees() {
  const { event } = useOutletContext();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);
  const [params] = useSearchParams();
  // the Search tab in the bottom bar links here with ?focus=search
  useEffect(() => { if (params.get("focus") === "search") searchRef.current?.focus(); }, [params]);
  const [fAttend, setFAttend] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPay, setFPay] = useState("");
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, label, tone, run }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!event) return;
    try {
      const [regs, emails] = await Promise.all([
        fetchAll(() => supabase.from("registrations").select("*, checker:profiles!registrations_checked_in_by_fkey(full_name,email), payment:payments(status,amount_paid,reference_number,review_note)").eq("event_id", event.id).order("created_at").order("id")),
        fetchAll(() => supabase.from("registration_email_status").select("registration_id,status,error,sent_at").eq("event_id", event.id).order("registration_id")),
      ]);
      const em = new Map(emails.map((e) => [e.registration_id, e]));
      setRows(regs.map((r) => ({ ...r, email_status: em.get(r.id)?.status || "none", email_error: em.get(r.id)?.error, pay_status: r.payment?.status || "none" })));
    } catch { setRows([]); toast("Could not load attendees", "error"); }
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(null); load(); }, [load]);

  const shown = useMemo(() => (rows || []).filter((r) => {
    if (fStatus && r.status !== fStatus) return false;
    if (fPay && r.pay_status !== fPay) return false;
    if (fAttend === "in" && !r.checked_in_at) return false;
    if (fAttend === "out" && r.checked_in_at) return false;
    if (fEmail && r.email_status !== fEmail) return false;
    if (q) { const s = `${r.name} ${r.x_username} ${r.email} ${r.ticket_number || ""} ${r.contact_number || ""} ${r.facebook_url || ""}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  }), [rows, q, fAttend, fEmail, fStatus, fPay]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg, "success"); await load(); } catch (e) { toast(e.message || "Failed", "error"); } finally { setBusy(false); }
  };

  const resend = (r) => run(async () => { await callFunction("send-confirmation-email", { registration_id: r.id }); }, `Email sent to ${r.email}`);
  const resendFailed = () => {
    const ids = rows.filter((r) => r.status === "confirmed" && r.email_status === "failed").map((r) => r.id);
    if (!ids.length) { toast("No failed emails", "info"); return; }
    setConfirm({ title: "Resend failed emails?", body: `Resend ${ids.length} failed confirmation email(s)?`, label: "Resend", tone: "primary", run: () => run(async () => { const { sent, failed } = await resendMany(ids); toast(`${sent} sent, ${failed} still failing`, failed ? "error" : "success"); }) });
  };
  const mark = (r, present) => run(async () => { const { error } = await supabase.rpc("mark_attendance", { p_registration_id: r.id, p_present: present }); if (error) throw error; setSel(null); }, present ? "Marked present" : "Attendance cleared");
  const setStatus = (r, status) => run(async () => { const { error } = await supabase.from("registrations").update({ status }).eq("id", r.id); if (error) throw error; setSel(null); }, "Updated");
  const restoreStatus = (r) => (r.ticket_number ? "confirmed" : "pending_verification");
  const remove = (r) => run(async () => { const { error } = await supabase.from("registrations").delete().eq("id", r.id); if (error) throw error; setSel(null); }, "Deleted");
  const saveEdit = (e) => {
    e.preventDefault();
    const x = normalizeX(edit.x_username);
    const fb = edit.facebook_url ? normalizeFacebook(edit.facebook_url) : null;
    const phone = edit.contact_number ? normalizePhone(edit.contact_number) : null;
    if (edit.name.trim().length < 2 || !/^[A-Za-z0-9_]{1,15}$/.test(x) || !/^\S+@\S+\.\S+$/.test(edit.email.trim())) { toast("Check the name, X username and email", "error"); return; }
    if ((edit.facebook_url && !fb) || (edit.contact_number && !phone)) { toast("Check the Facebook link and contact number", "error"); return; }
    // Changing name/email/X username is how a slot is transferred. The database logs who did it (registration_changes).
    run(async () => {
      const { error } = await supabase.from("registrations").update({ name: edit.name.trim(), x_username: x, email: edit.email.trim().toLowerCase(), facebook_url: fb, contact_number: phone, notes: edit.notes?.trim() || null }).eq("id", edit.id);
      if (error) throw error; setEdit(null); setSel(null);
    }, "Saved (change logged)");
  };

  const exportExcel = () => exportReport(toast, `attendees-${event.ticket_prefix}.xlsx`,
    ["Ticket", "Name", "X username", "Email", "Facebook", "Contact", "Kit", "Quantity", "Price per kit", "Total", "Notes", "Registered", "Registration status", "Payment status", "Payment reference", "Email status", "Checked in", "Checked in by", "Receipt verified", "Kit claimed"],
    shown.map((r) => [r.ticket_number || "", r.name, "@" + r.x_username, r.email, r.facebook_url, r.contact_number, r.kit_name || "", r.kit_name ? r.kit_quantity : "", r.kit_unit_price ?? "", r.total_amount ?? "", r.notes, fmtDateTime(r.created_at), r.status, r.pay_status === "none" ? "" : r.pay_status, r.payment?.reference_number || "", r.email_status, fmtDateTime(r.checked_in_at), r.checker?.full_name || r.checker?.email || "", r.receipt_verified ? "Yes" : "No", r.kit_claimed ? "Yes" : "No"]));

  if (!event) return <Empty>Create an event first.</Empty>;
  const cols = [
    { key: "name", label: "Name" },
    { key: "x_username", label: "X", render: (r) => "@" + r.x_username },
    { key: "ticket_number", label: "Ticket", className: "font-mono whitespace-nowrap", render: (r) => r.ticket_number || "—" },
    { key: "email", label: "Email" },
    { key: "facebook_url", label: "Facebook", render: (r) => (r.facebook_url ? <a href={r.facebook_url} target="_blank" rel="noopener noreferrer">Profile{" "}<span className="sr-only">of {r.name} (opens in a new tab)</span></a> : "—") },
    { key: "contact_number", label: "Contact", className: "whitespace-nowrap", render: (r) => r.contact_number || "—" },
    { key: "kit_name", label: "Kit", sortValue: (r) => r.kit_name || "", render: (r) => (r.kit_name ? `${r.kit_name} × ${r.kit_quantity}` : "—") },
    { key: "total_amount", label: "Total", className: "whitespace-nowrap", sortValue: (r) => Number(r.total_amount || 0), render: (r) => (Number(r.total_amount) > 0 ? peso(r.total_amount) : "—") },
    { key: "pay_status", label: "Payment", render: (r) => <span className={`badge ${PAY_BADGE[r.pay_status]}`}>{r.pay_status === "none" ? "n/a" : r.pay_status}</span> },
    { key: "created_at", label: "Registered", className: "whitespace-nowrap", render: (r) => fmtDateTime(r.created_at) },
    { key: "email_status", label: "Email", render: (r) => <span className={`badge ${EMAIL_BADGE[r.email_status]}`}>{r.email_status === "none" ? "not sent" : r.email_status}</span> },
    { key: "attendance", label: "Status", sortValue: (r) => (r.checked_in_at ? 1 : 0), render: (r) => r.status === "confirmed" ? (r.checked_in_at ? <span className="badge badge-ok">checked in</span> : <span className="badge badge-neutral">not yet</span>) : <span className={`badge ${STATUS_BADGE[r.status][0]}`}>{STATUS_BADGE[r.status][1]}</span> },
    { key: "actions", label: "", sortable: false, render: (r) => <button className="btn-secondary" onClick={() => setSel(r)}><IconEye />View{" "}<span className="sr-only">{r.name}</span></button> },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl"><IconUsers />Attendees</h1>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={resendFailed} disabled={busy || !rows}><IconSend />Resend all failed</button><TopBarAction className="btn-primary" icon={IconDownload} label="Export Excel" short="Export" onClick={exportExcel} disabled={!shown.length} /></div>
      </div>
      <FilterBar activeCount={[fStatus, fPay, fAttend, fEmail].filter(Boolean).length}
        search={<input ref={searchRef} className="input w-full md:w-72" placeholder="Search name, X, email, ticket, contact" aria-label="Search attendees" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <select className="input max-w-[13rem]" aria-label="Registration status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All registrations</option><option value="confirmed">Confirmed</option><option value="pending_verification">Pending verification</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select>
        <select className="input max-w-[12rem]" aria-label="Payment status" value={fPay} onChange={(e) => setFPay(e.target.value)}><option value="">Any payment</option><option value="pending">Payment pending</option><option value="verified">Payment verified</option><option value="underpaid">Underpaid</option><option value="rejected">Payment rejected</option><option value="none">No payment</option></select>
        <select className="input max-w-[11rem]" aria-label="Attendance" value={fAttend} onChange={(e) => setFAttend(e.target.value)}><option value="">Any attendance</option><option value="in">Checked in</option><option value="out">Not yet arrived</option></select>
        <select className="input max-w-[11rem]" aria-label="Email status" value={fEmail} onChange={(e) => setFEmail(e.target.value)}><option value="">Any email status</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="none">Not sent</option></select>
      </FilterBar>
      <p role="status" className="text-sm font-semibold">{rows ? `${shown.length} ${shown.length === 1 ? "attendee" : "attendees"} found` : "Loading attendees…"}</p>
      <DataTable caption="Attendees" columns={cols} rows={shown} loading={rows === null} empty="No attendees match." initialSort={{ key: "created_at", dir: "desc" }} />

      {sel && !edit && (
        <Modal title={sel.name} onClose={() => setSel(null)}>
          <dl className="space-y-1 text-sm">
            {[["Ticket", sel.ticket_number || "Not issued yet"], ["X username", "@" + sel.x_username], ["Email", sel.email], ["Facebook", sel.facebook_url || "—"], ["Contact", sel.contact_number || "—"], ["Kit", sel.kit_name ? `${sel.kit_name} × ${sel.kit_quantity} at ${peso(sel.kit_unit_price)}` : "—"], ["Total", Number(sel.total_amount) > 0 ? peso(sel.total_amount) : "—"], ["Notes", sel.notes || "—"],
              ["Registered", fmtDateTime(sel.created_at)], ["Status", sel.status.replace("_", " ")], ["Payment", sel.pay_status === "none" ? "n/a" : `${sel.pay_status}${sel.payment?.reference_number ? ` (ref ${sel.payment.reference_number})` : ""}`],
              ["Checked in", sel.checked_in_at ? `${fmtDateTime(sel.checked_in_at)}${sel.checker ? " by " + (sel.checker.full_name || sel.checker.email) : ""}` : "No"], ["Receipt verified", sel.receipt_verified ? "Yes" : "No"], ["Kit claimed", sel.kit_claimed ? "Yes" : "No"], ["Email status", sel.email_status + (sel.email_error ? ` (${sel.email_error})` : "")]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-ink-muted">{k}</dt><dd className="break-all text-right font-medium">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-muted">Payments are verified on the Payments page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={busy || sel.status !== "confirmed"} onClick={() => resend(sel)}><IconSend />Resend email</button>
            <button className="btn-secondary" disabled={busy || sel.status !== "confirmed"} onClick={() => mark(sel, !sel.checked_in_at)}>{sel.checked_in_at ? <IconUserX /> : <IconUserCheck />}{sel.checked_in_at ? "Clear attendance" : "Mark present"}</button>
            <button className="btn-secondary" onClick={() => setEdit({ ...sel })}><IconPencil />Edit / transfer</button>
            {sel.status === "cancelled" || sel.status === "rejected"
              ? <button className="btn-secondary" disabled={busy} onClick={() => setConfirm({ title: "Restore this slot?", body: `Restore ${sel.name}? The slot is taken again (it may fail if the event is full or the X username is in use).`, label: "Restore", tone: "primary", run: () => setStatus(sel, restoreStatus(sel)) })}><IconUndo />Restore slot</button>
              : <button className="btn-secondary" disabled={busy} onClick={() => setConfirm({ title: "Cancel this slot?", body: `Cancel ${sel.ticket_number || sel.name}? The slot is freed and the ticket stops working.`, label: "Cancel slot", tone: "danger", run: () => setStatus(sel, "cancelled") })}><IconXCircle />Cancel slot</button>}
            <button className="btn-danger" disabled={busy} onClick={() => setConfirm({ title: "Delete this registration?", body: `Permanently delete ${sel.name} (${sel.ticket_number || "no ticket"})?`, label: "Delete", tone: "danger", run: () => remove(sel) })}><IconTrash />Delete</button>
          </div>
        </Modal>
      )}
      {edit && (
        <Modal title="Edit / transfer slot" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <p className="alert alert-warn">To transfer a slot, enter the new owner&apos;s details. The ticket number stays the same, and the change is logged. Use &quot;Resend email&quot; afterwards to send them the ticket.</p>
            <Field id="e-name" label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field id="e-x" label="X username"><input className="input" value={edit.x_username} onChange={(e) => setEdit({ ...edit, x_username: e.target.value })} /></Field>
            <Field id="e-mail" label="Email"><input type="email" className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field id="e-fb" label="Facebook link"><input className="input" value={edit.facebook_url || ""} onChange={(e) => setEdit({ ...edit, facebook_url: e.target.value })} /></Field>
            <Field id="e-tel" label="Contact number"><input className="input" value={edit.contact_number || ""} onChange={(e) => setEdit({ ...edit, contact_number: e.target.value })} /></Field>
            <Field id="e-notes" label="Notes"><textarea className="input" rows={2} value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="sheet-actions flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}><IconClose />Cancel</button><button className="btn-primary" disabled={busy}><IconSave />Save</button></div>
          </form>
        </Modal>
      )}
      {confirm && <ConfirmDialog title={confirm.title} tone={confirm.tone} confirmLabel={confirm.label} busy={busy} onCancel={() => setConfirm(null)} onConfirm={async () => { await confirm.run(); setConfirm(null); }}>{confirm.body}</ConfirmDialog>}
    </div>
  );
}
