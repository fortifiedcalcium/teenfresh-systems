import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { callFunction, fetchAll, resendMany } from "../../lib/api.js";
import { MERGE_FIELDS, renderEmail, SAMPLE_EXTRA, SAMPLE_REG } from "../../lib/merge.js";
import { fetchEventImages, imageUrl } from "../../lib/eventImages.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import DataTable from "../../components/DataTable.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import Alert from "../../components/Alert.jsx";

/** HTML editor + merge-field chips + live preview. Used for both the saved template and the one-off bulk message. */
function Editor({ draft, setDraft, event }) {
  const refs = { html_body: useRef(null), text_body: useRef(null), subject: useRef(null) };
  const [focus, setFocus] = useState("html_body");

  const insert = (field) => {
    const tag = `{{${field}}}`;
    const el = refs[focus].current;
    const v = draft[focus];
    const [s, e] = el ? [el.selectionStart ?? v.length, el.selectionEnd ?? v.length] : [v.length, v.length];
    setDraft({ ...draft, [focus]: v.slice(0, s) + tag + v.slice(e) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length); });
  };

  const [banner, setBanner] = useState(null);
  useEffect(() => { fetchEventImages(event.id).then((imgs) => { const r = imgs.email_banner || imgs.banner; setBanner(r ? { url: imageUrl(r), alt: r.alt_text } : null); }); }, [event.id]);
  // the preview uses the same merge code as the Edge Functions, with a sample attendee and sample payment details
  const preview = useMemo(() => renderEmail(draft, { reg: SAMPLE_REG, event, site: window.location.origin, bannerUrl: banner?.url ?? event.banner_url, bannerAlt: banner?.alt, extra: SAMPLE_EXTRA }), [draft, event, banner]);
  const [view, setView] = useState("html");
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className="label">Merge fields <span className="font-normal text-ink-muted">(click to insert at the cursor in: {focus.replace("_body", "").replace("html", "HTML body").replace("text", "text body")})</span></p>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((f) => <button type="button" key={f} className="chip" onClick={() => insert(f)}>{`{{${f}}}`}</button>)}
          </div>
        </div>
        <div><label className="label" htmlFor="subj">Subject</label><input id="subj" ref={refs.subject} className="input" value={draft.subject} onFocus={() => setFocus("subject")} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div>
        <div><label className="label" htmlFor="html">HTML body</label><textarea id="html" ref={refs.html_body} rows={14} className="input font-mono text-xs" value={draft.html_body} onFocus={() => setFocus("html_body")} onChange={(e) => setDraft({ ...draft, html_body: e.target.value })} /></div>
        <div><label className="label" htmlFor="txt">Plain-text body</label><textarea id="txt" ref={refs.text_body} rows={9} className="input font-mono text-xs" value={draft.text_body} onFocus={() => setFocus("text_body")} onChange={(e) => setDraft({ ...draft, text_body: e.target.value })} /></div>
        <p className="text-xs text-ink-muted">Unknown fields are left blank, and every value is HTML-escaped before it is inserted.</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label mb-0">Live preview <span className="font-normal text-ink-muted">(sample attendee)</span></p>
          <div className="flex gap-1">{["html", "text"].map((v) => <button key={v} type="button" className={view === v ? "btn-primary px-3 py-1" : "btn-secondary px-3 py-1"} onClick={() => setView(v)}>{v === "html" ? "HTML" : "Plain text"}</button>)}</div>
        </div>
        <p className="rounded-lg bg-brand-ivory p-2 text-sm"><strong>Subject:</strong> {preview.subject}</p>
        {view === "html"
          ? <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[640px] w-full rounded-lg border border-link bg-white" />
          : <pre className="h-[640px] overflow-auto whitespace-pre-wrap rounded-lg border border-link bg-white p-3 font-sans text-sm">{preview.text}</pre>}
      </div>
    </div>
  );
}

const KINDS = [
  ["confirmation", "Confirmation (sent when a payment is verified)"],
  ["payment_underpaid", "Payment underpaid"],
  ["payment_rejected", "Payment rejected"],
  ["acknowledgment", "Registration received (optional, see Events)"],
];

function TemplateTab({ event }) {
  const { user } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState("confirmation");
  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [testTo, setTestTo] = useState(user?.email || "");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setDraft(null); setLoadError("");
    supabase.from("email_templates").select("subject,html_body,text_body").eq("event_id", event.id).eq("kind", kind).maybeSingle()
      .then(({ data, error }) => {
        // Never show a blank editor after a failed load: saving it would overwrite the real template.
        if (error) setLoadError(/kind|42703/.test(`${error.code} ${error.message}`) ? "The database has not been updated yet (the email_templates.kind column is missing). Run supabase/migrations/002_registration_payments.sql in the Supabase SQL Editor. Your saved template is untouched." : `Could not load this template: ${error.message}`);
        else setDraft(data || { subject: "", html_body: "", text_body: "" });
      });
  }, [event.id, kind]);

  if (loadError) return <Alert tone="bad">{loadError}</Alert>;
  if (!draft) return <Loading />;
  const save = async () => {
    setBusy("save");
    const { error } = await supabase.from("email_templates").upsert({ event_id: event.id, kind, ...draft, updated_at: new Date().toISOString() }, { onConflict: "event_id,kind" });
    setBusy(""); error ? toast(error.message, "error") : toast("Template saved", "success");
  };
  const test = async () => {
    setBusy("test");
    try { await callFunction("send-confirmation-email", { test_to: testTo, event_id: event.id, kind, template: draft }); toast(`Test sent to ${testTo}`, "success"); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(""); }
  };
  return (
    <div className="space-y-4">
      <div><label htmlFor="tpl-kind" className="label">Email</label>
        <select id="tpl-kind" className="input max-w-lg" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <Editor draft={draft} setDraft={setDraft} event={event} />
      <div className="flex flex-wrap items-center gap-2 border-t border-link pt-4">
        <button className="btn-primary" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save template"}</button>
        <input type="email" className="input max-w-xs" aria-label="Send test to" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        <button className="btn-secondary" onClick={test} disabled={!!busy || !testTo}>{busy === "test" ? "Sending…" : "Send test to myself"}</button>
      </div>
    </div>
  );
}

function BulkTab({ event }) {
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [count, setCount] = useState(null);
  const [testTo, setTestTo] = useState(user?.email || "");
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    supabase.from("email_templates").select("subject,html_body,text_body").eq("event_id", event.id).eq("kind", "confirmation").maybeSingle().then(({ data, error }) => (error ? setLoadError("Could not load the confirmation template. If you have not run supabase/migrations/002_registration_payments.sql yet, run it first.") : setDraft(data || { subject: "", html_body: "", text_body: "" })));
  }, [event.id]);

  useEffect(() => {
    setCount(null);
    (async () => {
      let q = supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed");
      if (filter === "checked_in") q = q.not("checked_in_at", "is", null);
      if (filter === "not_checked_in") q = q.is("checked_in_at", null);
      if (filter === "email_failed") {
        const { data } = await supabase.from("registration_email_status").select("status").eq("event_id", event.id).eq("status", "failed");
        setCount(data?.length ?? 0); return;
      }
      const { count: c } = await q; setCount(c ?? 0);
    })();
  }, [event.id, filter]);

  if (loadError) return <Alert tone="bad">{loadError}</Alert>;
  if (!draft) return <Loading />;
  const body = { event_id: event.id, filter, template: draft };

  const test = async () => {
    try { await callFunction("send-bulk-email", { ...body, test_to: testTo }); toast(`Test sent to ${testTo}`, "success"); } catch (e) { toast(e.message, "error"); }
  };
  const sendAll = async () => {
    if (!count) return;
    if (!window.confirm(`Send this email to ${count} attendee(s)? This cannot be undone.`)) return;
    let offset = 0, sent = 0, failed = 0;
    setProgress({ done: 0, total: count });
    try {
      while (offset !== null) {
        const r = await callFunction("send-bulk-email", { ...body, offset });
        sent += r.sent; failed += r.failed; offset = r.next_offset;
        setProgress({ done: r.processed, total: r.total });
      }
      toast(`Done: ${sent} sent, ${failed} failed`, failed ? "error" : "success");
    } catch (e) { toast(e.message, "error"); }
    setProgress(null);
  };
  return (
    <div className="space-y-4">
      <p className="alert alert-info">Write a one-off message. It starts from your confirmation template and is <strong>not</strong> saved. Each recipient gets their own merged copy.</p>
      <Editor draft={draft} setDraft={setDraft} event={event} />
      <div className="flex flex-wrap items-center gap-2 border-t border-link pt-4">
        <label className="text-sm font-medium" htmlFor="grp">Recipients</label>
        <select id="grp" className="input max-w-[14rem]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All confirmed attendees</option><option value="checked_in">Checked in</option><option value="not_checked_in">Not yet arrived</option><option value="email_failed">Confirmation email failed</option>
        </select>
        <span className="text-sm text-ink-muted">{count === null ? "…" : `${count} recipient${count === 1 ? "" : "s"}`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="email" className="input max-w-xs" aria-label="Send test to" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        <button className="btn-secondary" onClick={test} disabled={!!progress || !testTo}>Send test to myself</button>
        <button className="btn-danger" onClick={sendAll} disabled={!!progress || !count}>{progress ? `Sending ${progress.done}/${progress.total}…` : "Send to recipients"}</button>
      </div>
    </div>
  );
}

function LogsTab({ event }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("email_logs").select("id,registration_id,recipient,kind,status,error,sent_at,registrations!left(event_id,ticket_number,name)").order("sent_at", { ascending: false }).limit(500);
    setRows((data || []).filter((l) => !l.registrations || l.registrations.event_id === event.id));
  }, [event.id]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const resendFailed = async () => {
    const st = await fetchAll(() => supabase.from("registration_email_status").select("registration_id,status").eq("event_id", event.id).order("registration_id"));
    const ids = st.filter((s) => s.status === "failed").map((s) => s.registration_id);
    if (!ids.length) { toast("No failed emails", "info"); return; }
    if (!window.confirm(`Resend ${ids.length} failed email(s)?`)) return;
    setBusy(true);
    try { const { sent, failed } = await resendMany(ids); toast(`${sent} sent, ${failed} still failing`, failed ? "error" : "success"); } catch (e) { toast(e.message, "error"); }
    setBusy(false); load();
  };
  const resendOne = async (id) => {
    try { await callFunction("send-confirmation-email", { registration_id: id }); toast("Sent", "success"); } catch (e) { toast(e.message, "error"); }
    load();
  };
  const cols = [
    { key: "sent_at", label: "When", className: "whitespace-nowrap", render: (l) => fmtDateTime(l.sent_at) },
    { key: "kind", label: "Type" },
    { key: "recipient", label: "To" },
    { key: "ticket", label: "Ticket", className: "font-mono", sortValue: (l) => l.registrations?.ticket_number || "", render: (l) => l.registrations?.ticket_number || "—" },
    { key: "status", label: "Result", render: (l) => <span className={`badge ${l.status === "sent" ? "badge-ok" : "badge-bad"}`}>{l.status}</span> },
    { key: "error", label: "Error", className: "max-w-xs break-words text-xs text-danger", render: (l) => l.error || "" },
    { key: "act", label: "", sortable: false, render: (l) => l.status === "failed" && l.registration_id && l.kind === "confirmation" ? <button className="btn-secondary" onClick={() => resendOne(l.registration_id)}>Resend{" "}<span className="sr-only">to {l.recipient}</span></button> : null },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-[10rem]" aria-label="Result filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All results</option><option value="sent">Sent</option><option value="failed">Failed</option></select>
        <button className="btn-secondary" onClick={load}>Refresh</button>
        <button className="btn-primary" onClick={resendFailed} disabled={busy}>{busy ? "Resending…" : "Resend all failed"}</button>
      </div>
      <DataTable caption="Email logs" columns={cols} rows={(rows || []).filter((l) => !status || l.status === status)} loading={rows === null} empty="No emails logged yet." pageSize={30} />
    </div>
  );
}

export default function EmailTemplates() {
  const { event } = useOutletContext();
  const [tab, setTab] = useState("template");
  if (!event) return <Empty>Create an event first.</Empty>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Email</h1>
      <div className="flex flex-wrap gap-2" role="tablist">
        {[["template", "Confirmation template"], ["bulk", "Bulk mail merge"], ["logs", "Email logs"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "btn-primary" : "btn-secondary"} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "template" && <TemplateTab event={event} />}
      {tab === "bulk" && <BulkTab event={event} />}
      {tab === "logs" && <LogsTab event={event} />}
    </div>
  );
}
