import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { DEFAULT_TEMPLATES, ORDER_FIELDS, ORDER_KINDS, renderOrderEmail, unknownOrderFields } from "../../lib/orderEmail.js";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import Field from "../../components/Field.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { IconMail, IconRefresh, IconSave } from "../../components/NavIcons.jsx";

const LABEL = { order_received: "Order received", order_paid: "Payment confirmed", order_shipped: "Order shipped", order_cancelled: "Order cancelled" };
const WHEN = {
  order_received: "Sent right after the shopper places the order.",
  order_paid: "Sent when you mark an order as paid.",
  order_shipped: "Sent when you mark an order as shipped.",
  order_cancelled: "Sent when you cancel an order.",
};
const SAMPLE_ORDER = { id: "sample", order_number: "TF-000123", name: "Juan Dela Cruz", email: "juan@example.com", phone: "+639171234567", address: "12 Rizal St., Brgy. Poblacion", city: "Makati", postal_code: "1210", subtotal_usd: 25.56, usd_to_php: 58, shipping_php: 150, total_php: 1632.48 };
const SAMPLE_ITEMS = [{ artist: "Marv", title: "ÖRBITAL", unit_price_usd: 12.78, quantity: 2 }];

const wording = (rows, k) => { const r = rows?.[k]; return r ? { subject: r.subject, heading: r.heading, body: r.body } : DEFAULT_TEMPLATES[k]; };

/** Admin: the wording of each shop order email. The items, totals and delivery address are added automatically. */
export default function OrderEmails() {
  const toast = useToast();
  const [saved, setSaved] = useState(null);          // kind -> saved row
  const [kind, setKind] = useState(ORDER_KINDS[0]);
  const [draft, setDraft] = useState(DEFAULT_TEMPLATES[ORDER_KINDS[0]]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("order_email_templates").select("*").then(({ data }) => setSaved(Object.fromEntries((data || []).map((r) => [r.kind, r]))));
  }, []);
  useEffect(() => { if (saved) { setDraft(wording(saved, kind)); setError(""); } }, [kind, saved]);

  const preview = useMemo(() => renderOrderEmail(kind, SAMPLE_ORDER, SAMPLE_ITEMS, "", draft), [kind, draft]);
  if (!saved) return <Loading label="Loading emails…" />;

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const customised = Boolean(saved[kind]);
  const unchanged = JSON.stringify(draft) === JSON.stringify(wording(saved, kind));

  const save = async (ev) => {
    ev.preventDefault(); setError("");
    for (const [k, label] of [["subject", "Subject"], ["heading", "Heading"], ["body", "Message"]]) {
      if (!draft[k].trim()) return setError(`${label} cannot be empty. To go back to the original wording, use "Restore default wording".`);
      const bad = unknownOrderFields(draft[k]);
      if (bad.length) return setError(`${label} has a placeholder that does not exist: {{${bad[0]}}}. Use ${ORDER_FIELDS.map((f) => `{{${f}}}`).join(", ")}.`);
    }
    if (draft.subject.length > 200 || draft.heading.length > 120 || draft.body.length > 2000) return setError("The subject can be 200 characters, the heading 120 and the message 2000.");
    setBusy(true);
    const row = { kind, subject: draft.subject.trim(), heading: draft.heading.trim(), body: draft.body.trim(), updated_at: new Date().toISOString() };
    const { error: err } = await supabase.from("order_email_templates").upsert(row, { onConflict: "kind" });
    setBusy(false);
    if (err) return setError(err.message);
    setSaved((s) => ({ ...s, [kind]: row }));
    toast(`${LABEL[kind]} email saved`, "success");
  };
  const restore = async () => {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("order_email_templates").delete().eq("kind", kind);
    setBusy(false);
    if (err) return setError(err.message);
    setSaved((s) => { const n = { ...s }; delete n[kind]; return n; });
    toast("Original wording restored", "success");
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl"><IconMail />Order emails</h1>
      <p className="text-sm text-ink-muted">Edit what shoppers read in their order emails. The items, totals and delivery address are added under your text automatically.</p>

      <div role="tablist" aria-label="Emails" className="flex flex-wrap gap-2">
        {ORDER_KINDS.map((k) => (
          <button key={k} role="tab" id={`tab-${k}`} aria-selected={kind === k} aria-controls="email-panel" className={kind === k ? "btn-primary" : "btn-secondary"} onClick={() => setKind(k)}>{LABEL[k]}{saved[k] && <span className="sr-only"> (edited)</span>}</button>
        ))}
      </div>

      <div id="email-panel" role="tabpanel" aria-labelledby={`tab-${kind}`} className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <form onSubmit={save} className="card space-y-4 p-4" noValidate>
          <p className="text-sm">{WHEN[kind]} {customised ? <strong>Using your wording.</strong> : "Using the original wording."}</p>
          {error && <Alert tone="bad">{error}</Alert>}
          <Field id="oe-subject" label="Subject" required><input className="input" maxLength={200} value={draft.subject} onChange={set("subject")} /></Field>
          <Field id="oe-heading" label="Heading" required hint="The big line at the top of the email"><input className="input" maxLength={120} value={draft.heading} onChange={set("heading")} /></Field>
          <Field id="oe-body" label="Message" required hint="Leave a blank line to start a new paragraph"><textarea className="input" rows={8} maxLength={2000} value={draft.body} onChange={set("body")} /></Field>
          <p className="hint">Placeholders you can type: {ORDER_FIELDS.map((f, i) => <span key={f}>{i > 0 && ", "}<code>{`{{${f}}}`}</code></span>)}. They are replaced with each shopper's details.</p>
          <div className="flex flex-wrap justify-between gap-2 border-t border-brand-sky pt-3">
            <button type="button" className="btn-secondary" onClick={restore} disabled={busy || !customised}><IconRefresh />Restore default wording</button>
            <button className="btn-primary" disabled={busy || unchanged}><IconSave />{busy ? "Saving…" : "Save wording"}</button>
          </div>
        </form>

        <section className="card space-y-2 p-4" aria-labelledby="oe-preview-h">
          <h2 id="oe-preview-h" className="text-lg font-black">Preview</h2>
          <p className="text-sm text-ink-muted">With a sample order. This is the plain-text version; the email also has the Teenfresh header and a table of items.</p>
          <p className="text-sm"><span className="font-semibold">Subject:</span> {preview.subject}</p>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-brand-sky bg-brand-ivory p-3 text-sm" aria-label="Email preview">{preview.text}</pre>
        </section>
      </div>
    </div>
  );
}
