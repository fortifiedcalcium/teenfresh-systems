import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { useToast } from "../../components/Toast.jsx";
import Modal from "../../components/Modal.jsx";
import Field from "../../components/Field.jsx";
import Alert from "../../components/Alert.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import TermsEditor from "../../components/TermsEditor.jsx";
import { sanitize } from "../../components/SafeHtml.jsx";
import MediaTab from "./MediaTab.jsx";
import KitsTab from "./KitsTab.jsx";
import { Empty } from "../../components/Spinner.jsx";
import { fmtDateTime } from "../../lib/availability.js";
import { peso } from "../../lib/payment.js";
import { IconCalendar, IconClose, IconImage, IconInfo, IconLock, IconPackage, IconPencil, IconPlus, IconSave, IconTrash, IconUnlock } from "../../components/NavIcons.jsx";

// <input type="datetime-local"> works in local time; the database stores an absolute instant.
const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const blank = () => ({
  title: "", subtitle: "", description: "", venue: "", venue_address: "", event_date: "", ends_at: "", registration_deadline: "", capacity: 100, ticket_prefix: "TICKET",
  registration_fee: 0, fee_note: "", hashtags: "", kit_inclusions: "", payment_account_name: "", payment_account_number: "", contact_links: "",
  registration_open: true, send_ack_email: false, receipt_retention_days: "", terms_html: "",
});

const toForm = (e) => ({
  ...blank(), ...e,
  subtitle: e.subtitle || "", description: e.description || "", venue: e.venue || "", venue_address: e.venue_address || "", fee_note: e.fee_note || "",
  event_date: toLocalInput(e.event_date), ends_at: toLocalInput(e.ends_at), registration_deadline: toLocalInput(e.registration_deadline),
  hashtags: (e.hashtags || []).join(" "), kit_inclusions: (e.kit_inclusions || []).join("\n"),
  payment_account_name: e.payment_account_name || "", payment_account_number: e.payment_account_number || "",
  contact_links: (e.contact_links || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
  receipt_retention_days: e.receipt_retention_days ?? "", terms_html: e.terms_html || "",
});

/** sanitized Terms HTML, or null when the editor holds no text */
const cleanTerms = (html) => { const c = sanitize(html).trim(); return c.replace(/<[^>]*>|&nbsp;|\s/g, "") ? c : null; };

/** "Facebook | https://..." lines -> [{label, url}], or an error message */
function parseLinks(text) {
  const out = [];
  for (const [i, line] of text.split("\n").map((l) => l.trim()).entries()) {
    if (!line) continue;
    const [label, ...rest] = line.split("|");
    const url = rest.join("|").trim();
    if (!label.trim() || !/^(https?:\/\/|mailto:)\S+$/i.test(url)) return { error: `Contact link line ${i + 1} should look like: Facebook | https://www.facebook.com/TeenfreshPH` };
    out.push({ label: label.trim(), url });
  }
  return { links: out };
}

export default function Events() {
  const { events, reloadEvents } = useOutletContext();
  const toast = useToast();
  const [form, setForm] = useState(null); // null closed; object = editing (id present) or new
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const open = (e) => { setForm(e ? toForm(e) : blank()); setTab("details"); setError(""); };

  const save = async (ev) => {
    ev.preventDefault();
    setError("");
    const cap = parseInt(form.capacity, 10), fee = Number(form.registration_fee || 0);
    if (!form.title.trim() || !form.event_date) return setError("Title and start date are required.");
    if (!(cap > 0)) return setError("Capacity must be above 0.");
    if (!(fee >= 0)) return setError("The registration fee cannot be negative.");
    if (!/^[A-Z0-9]{2,12}$/.test(form.ticket_prefix)) return setError("Ticket prefix: 2 to 12 capital letters or numbers.");
    if (form.ends_at && new Date(form.ends_at) < new Date(form.event_date)) return setError("The end time is before the start time.");
    if (form.registration_deadline && new Date(form.registration_deadline) > new Date(form.event_date)) return setError("The registration deadline is after the event starts.");
    const parsed = parseLinks(form.contact_links);
    if (parsed.error) return setError(parsed.error);
    const days = form.receipt_retention_days === "" ? null : parseInt(form.receipt_retention_days, 10);
    if (days !== null && !(days >= 0)) return setError("Receipt retention must be 0 or more days.");

    setSaving(true);
    const row = {
      title: form.title.trim(), subtitle: form.subtitle.trim() || null, description: form.description.trim() || null,
      venue: form.venue.trim() || null, venue_address: form.venue_address.trim() || null,
      event_date: fromLocalInput(form.event_date), ends_at: fromLocalInput(form.ends_at), registration_deadline: fromLocalInput(form.registration_deadline),
      capacity: cap, ticket_prefix: form.ticket_prefix, registration_fee: fee, fee_note: form.fee_note.trim() || null,
      price_info: fee > 0 ? `${peso(fee)}${form.fee_note.trim() ? ` ${form.fee_note.trim()}` : ""}` : null,
      hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean), kit_inclusions: form.kit_inclusions.split("\n").map((s) => s.trim()).filter(Boolean),
      payment_account_name: form.payment_account_name.trim() || null, payment_account_number: form.payment_account_number.trim() || null,
      contact_links: parsed.links, registration_open: form.registration_open, send_ack_email: form.send_ack_email,
      receipt_retention_days: days, terms_html: cleanTerms(form.terms_html),
    };
    const { data, error: err } = form.id ? await supabase.from("events").update(row).eq("id", form.id).select().single() : await supabase.from("events").insert(row).select().single();
    setSaving(false);
    if (err) return setError(err.message);
    toast("Event saved", "success");
    reloadEvents();
    if (form.id) setForm(toForm(data)); else { setForm(toForm(data)); setTab("kits"); }   // a new event goes straight to its kits and images
  };

  const toggleOpen = async (e) => {
    const { error: err } = await supabase.from("events").update({ registration_open: !e.registration_open }).eq("id", e.id);
    if (err) toast(err.message, "error"); else reloadEvents();
  };
  const remove = async () => {
    const { error: err } = await supabase.from("events").delete().eq("id", deleting.id);
    if (err) toast(err.message, "error"); else { toast("Event deleted", "success"); reloadEvents(); }
    setDeleting(null);
  };

  const current = form?.id ? events.find((e) => e.id === form.id) : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl"><IconCalendar />Events</h1><button className="btn-primary" onClick={() => open(null)}><IconPlus />New event</button></div>
      {events.length === 0 ? <Empty>No events yet.</Empty> : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="font-bold">{e.title}</h2>
                <p className="text-sm text-ink-muted">{fmtDateTime(e.event_date)} · {e.venue || "No venue"} · capacity {e.capacity} · {Number(e.registration_fee) > 0 ? peso(e.registration_fee) : "free"}</p>
                {e.registration_deadline && <p className="text-sm text-ink-muted">Registration closes {fmtDateTime(e.registration_deadline)}</p>}
                <span className={`badge mt-1 ${e.registration_open ? "badge-ok" : "badge-bad"}`}>{e.registration_open ? "Registration open" : "Registration closed"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => toggleOpen(e)}>{e.registration_open ? <IconLock /> : <IconUnlock />}{e.registration_open ? "Close registration" : "Open registration"}{" "}<span className="sr-only">for {e.title}</span></button>
                <button className="btn-secondary" onClick={() => open(e)}><IconPencil />Edit{" "}<span className="sr-only">{e.title}</span></button>
                <button className="btn-danger" onClick={() => setDeleting(e)}><IconTrash />Delete{" "}<span className="sr-only">{e.title}</span></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <Modal title={form.id ? "Edit event" : "New event"} onClose={() => setForm(null)} wide>
          <div role="tablist" aria-label="Event sections" className="mb-4 flex gap-2">
            {[["details", "Details", IconInfo], ["kits", "Kits", IconPackage], ["media", "Media", IconImage]].map(([k, l, I]) => (
              <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className={tab === k ? "btn-primary" : "btn-secondary"} disabled={k !== "details" && !form.id} onClick={() => setTab(k)}><I />{l}</button>
            ))}
            {!form.id && <p className="self-center text-sm text-ink-muted">Save the event first to add kits and images.</p>}
          </div>

          {tab === "details" && (
            <div id="panel-details" role="tabpanel" aria-labelledby="tab-details">
            <form onSubmit={save} className="space-y-5" noValidate>
              {error && <Alert tone="bad">{error}</Alert>}
              <fieldset className="space-y-4"><legend className="text-lg font-bold">Basics</legend>
                <Field id="title" label="Title" required><input className="input" value={form.title} onChange={set("title")} /></Field>
                <Field id="subtitle" label="Subtitle"><input className="input" value={form.subtitle} onChange={set("subtitle")} /></Field>
                <Field id="description" label="Description"><textarea className="input" rows={2} value={form.description} onChange={set("description")} /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="venue" label="Venue"><input className="input" value={form.venue} onChange={set("venue")} /></Field>
                  <Field id="venue_address" label="Address" hint="Used for the Open in Google Maps link"><input className="input" value={form.venue_address} onChange={set("venue_address")} /></Field>
                  <Field id="date" label="Start (Manila time shown to attendees)" required><input type="datetime-local" className="input" value={form.event_date} onChange={set("event_date")} /></Field>
                  <Field id="ends_at" label="End"><input type="datetime-local" className="input" value={form.ends_at} onChange={set("ends_at")} /></Field>
                  <Field id="deadline" label="Registration deadline" hint="Empty = until the event starts"><input type="datetime-local" className="input" value={form.registration_deadline} onChange={set("registration_deadline")} /></Field>
                  <Field id="capacity" label="Capacity" required hint="Pending forms count toward capacity"><input type="number" min="1" className="input" value={form.capacity} onChange={set("capacity")} /></Field>
                  <Field id="prefix" label="Ticket prefix" hint="IVEMONOP gives IVEMONOP-000123"><input className="input font-mono uppercase" value={form.ticket_prefix} onChange={(e) => setForm((f) => ({ ...f, ticket_prefix: e.target.value.toUpperCase() }))} /></Field>
                </div>
                <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={form.registration_open} onChange={set("registration_open")} /> Registration open</label>
                <Field id="hashtags" label="Hashtags" hint="Separated by spaces, for example #IVEMON_OP #Teenfresh"><input className="input" value={form.hashtags} onChange={set("hashtags")} /></Field>
                <Field id="kit" label="Kit inclusions" hint="One per line, for example (1) Cupsleeve"><textarea className="input" rows={3} value={form.kit_inclusions} onChange={set("kit_inclusions")} /></Field>
              </fieldset>

              <fieldset className="space-y-4"><legend className="text-lg font-bold">Fee and payment (GCash)</legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="fee" label="Registration fee (PHP)" hint="Used only when the event has no kits (see the Kits tab). 0 = free event: no payment step, tickets are issued immediately"><input type="number" min="0" step="0.01" className="input" value={form.registration_fee} onChange={set("registration_fee")} /></Field>
                  <Field id="fee_note" label="Fee note" hint="Shown after the fee, for example: exclusive of food and drinks"><input className="input" value={form.fee_note} onChange={set("fee_note")} /></Field>
                  <Field id="pay_name" label="GCash account name (masked)" hint="Store it already masked, for example BR**N CA**O S."><input className="input" value={form.payment_account_name} onChange={set("payment_account_name")} /></Field>
                  <Field id="pay_number" label="GCash number"><input className="input" inputMode="numeric" value={form.payment_account_number} onChange={set("payment_account_number")} /></Field>
                </div>
                <p className="text-sm text-ink-muted">The GCash number is shown to every visitor of the registration form, like on a public form.</p>
              </fieldset>

              <fieldset className="space-y-4"><legend className="text-lg font-bold">Terms and contact</legend>
                <Field id="terms_html" label="Terms and Conditions" hint="Format it with the buttons, no HTML needed. Shown on the form and merged into the confirmation email as {{Terms}}"><TermsEditor id="terms_html" value={form.terms_html} onChange={(v) => setForm((f) => ({ ...f, terms_html: v }))} /></Field>
                <Field id="contact" label="Contact links" hint="One per line: Label | URL. Facebook, X, Instagram, TikTok, Gmail (mailto:you@example.com)"><textarea className="input font-mono text-sm" rows={5} value={form.contact_links} onChange={set("contact_links")} /></Field>
              </fieldset>

              <fieldset className="space-y-3"><legend className="text-lg font-bold">Emails and privacy</legend>
                <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={form.send_ack_email} onChange={set("send_ack_email")} /> Send a "We received your registration" email right after someone submits (off by default)</label>
                <Field id="retention" label="Delete payment receipts this many days after the event" hint="Empty = keep them. Run scripts/purge-receipts.mjs (see the README) to carry it out."><input type="number" min="0" className="input" value={form.receipt_retention_days} onChange={set("receipt_retention_days")} /></Field>
              </fieldset>

              <div className="sheet-actions flex justify-end gap-2 border-t border-brand-sky"><button type="button" className="btn-secondary" onClick={() => setForm(null)}><IconClose />Close</button><button className="btn-primary" disabled={saving}><IconSave />{saving ? "Saving…" : "Save event"}</button></div>
            </form>
            </div>
          )}
          {tab === "kits" && current && <div id="panel-kits" role="tabpanel" aria-labelledby="tab-kits"><KitsTab event={current} /></div>}
          {tab === "media" && current && <div id="panel-media" role="tabpanel" aria-labelledby="tab-media"><MediaTab event={current} /></div>}
        </Modal>
      )}
      {deleting && <ConfirmDialog title="Delete this event?" confirmLabel="Delete event" onCancel={() => setDeleting(null)} onConfirm={remove}>Delete <strong>{deleting.title}</strong> and ALL its registrations, payments and images? This cannot be undone. Receipt files in storage are not removed automatically.</ConfirmDialog>}
    </div>
  );
}
