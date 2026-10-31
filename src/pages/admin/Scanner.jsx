import React, { useCallback, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { friendlyError } from "../../lib/api.js";
import { feedback } from "../../lib/beep.js";
import { fmtDateTime } from "../../lib/availability.js";
import QrScanner from "../../components/QrScanner.jsx";

// Result panels: surface colour + icon + big text. Sound and vibration are extras, never the only cue (1.4.1).
const PANEL = {
  success: { cls: "bg-brand-mint text-success border-success", icon: "✓", title: "Valid ticket" },
  duplicate: { cls: "bg-brand-cream text-warning-ink border-warning-ink", icon: "!", title: "Already checked in" },
  invalid: { cls: "bg-brand-blush text-danger border-danger", icon: "✕", title: "Invalid ticket" },
};

const REASON = {
  cancelled: "This registration was cancelled.",
  rejected: "This registration was rejected.",
  pending_verification: "This registration is still waiting for payment verification, so it has no valid ticket.",
  not_found: "Ticket not found.",
};

const summary = (r) => {
  if (!r) return "";
  const kit = r.kit_name ? ` Kit: ${r.kit_name}, quantity ${r.kit_quantity}.` : "";
  const who = r.name ? `${r.name}, X username ${r.x_username}, ticket ${r.ticket_number}.${kit}` : `Ticket ${r.ticket_number}.`;
  if (r.result === "success") return `Valid ticket. ${who} Checked in.`;
  if (r.result === "duplicate") return `Already checked in. ${who} First scanned ${fmtDateTime(r.checked_in_at)}${r.checked_in_by_name ? ` by ${r.checked_in_by_name}` : ""}.`;
  return `Invalid ticket. ${r.message || REASON[r.reason] || REASON.not_found} ${r.ticket_number || ""}`;
};

export default function Scanner() {
  const { event } = useOutletContext();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState(null);
  const [flags, setFlags] = useState({ kit: false, receipt: false });
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("scan_sound") !== "off"; } catch { return true; } });
  const busyRef = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const toggleSound = () => { const n = !sound; setSound(n); try { localStorage.setItem("scan_sound", n ? "on" : "off"); } catch { /* ignore */ } };

  const checkIn = useCallback(async (ticket) => {
    if (busyRef.current || !ticket.trim()) return;
    busyRef.current = true; setBusy(true);
    const { data, error } = await supabase.rpc("check_in_attendee", { p_ticket: ticket.trim() });
    busyRef.current = false; setBusy(false);
    const r = error ? { result: "invalid", reason: "error", message: friendlyError(error), ticket_number: ticket } : data;
    setResult(r);
    if (!error) setFlags({ kit: !!data.kit_claimed, receipt: !!data.receipt_verified });
    if (soundRef.current) feedback(r.result);
  }, []);

  const updateFlag = async (key, value) => {
    setFlags((f) => ({ ...f, [key]: value }));
    await supabase.from("registrations").update(key === "kit" ? { kit_claimed: value } : { receipt_verified: value }).eq("id", result.registration_id);
  };

  const search = async (e) => {
    e.preventDefault();
    const q = query.trim().replace(/[%,()]/g, " ");
    if (!q) return;
    let req = supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,status").eq("status", "confirmed")
      .or(`name.ilike.%${q}%,x_username.ilike.%${q.replace(/^@/, "")}%,ticket_number.ilike.%${q}%`).order("name").limit(15);
    if (event) req = req.eq("event_id", event.id);
    const { data } = await req;
    setMatches(data || []);
  };

  const p = result && PANEL[result.result];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl">QR Scanner</h1>

      <section aria-labelledby="scan-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="scan-h" className="text-lg">Scan a ticket</h2>
          <button type="button" className="btn-secondary" aria-pressed={sound} onClick={toggleSound}>Sound and vibration: {sound ? "on" : "off"}</button>
        </div>
        <QrScanner onScan={checkIn} paused={busy} />
      </section>

      {/* One assertive live region: every scan result is announced with name, X username, ticket and status. */}
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{busy ? "Checking ticket" : summary(result)}</div>
      {busy && <p className="text-center text-ink-muted" aria-hidden="true">Checking…</p>}
      {p && (
        <section aria-label="Scan result" className={`rounded-2xl border-4 p-6 text-center ${p.cls}`}>
          <p className="text-5xl font-extrabold" aria-hidden="true">{p.icon}</p>
          <h2 className="mt-1 text-3xl font-extrabold" style={{ color: "inherit" }}>{p.title}</h2>
          {result.result === "invalid" ? (
            <p className="mt-2 text-lg">{result.message || REASON[result.reason] || REASON.not_found}<br /><span className="font-mono text-base">{result.ticket_number}</span></p>
          ) : (
            <div className="mt-3 space-y-1">
              <p className="text-3xl font-extrabold">{result.name}</p>
              <p className="text-xl">@{result.x_username}</p>
              <p className="font-mono text-lg">{result.ticket_number}</p>
              {result.kit_name && <p className="text-xl font-bold">Kit: {result.kit_name} × {result.kit_quantity}</p>}
              {result.result === "duplicate" && <p className="mt-2 text-lg font-bold">First scanned {fmtDateTime(result.checked_in_at)}{result.checked_in_by_name ? ` by ${result.checked_in_by_name}` : ""}</p>}
              <fieldset className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-x-6 rounded-xl border-2 border-current bg-white p-3 text-left text-base text-ink">
                <legend className="px-2 text-sm font-bold">After check-in</legend>
                <label className="flex min-h-target items-center gap-2"><input type="checkbox" className="check" checked={flags.receipt} onChange={(e) => updateFlag("receipt", e.target.checked)} /> Receipt verified (₱200 or more)</label>
                <label className="flex min-h-target items-center gap-2"><input type="checkbox" className="check" checked={flags.kit} onChange={(e) => updateFlag("kit", e.target.checked)} /> Kit claimed</label>
              </fieldset>
            </div>
          )}
          <button className="btn-secondary mt-4" onClick={() => setResult(null)}>Dismiss result</button>
        </section>
      )}

      {/* An equal alternative to the camera, not a hidden fallback */}
      <section id="manual-checkin" tabIndex={-1} aria-labelledby="manual-h" className="card space-y-4 p-4">
        <h2 id="manual-h" className="text-lg">Manual check-in</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); checkIn(manual); setManual(""); }}>
          <div className="min-w-0 flex-1"><label htmlFor="ticket-input" className="label">Ticket number</label><input id="ticket-input" className="input font-mono uppercase" placeholder="IVEMON-000123" autoComplete="off" value={manual} onChange={(e) => setManual(e.target.value)} /></div>
          <button className="btn-primary self-end" disabled={busy || !manual.trim()}>Check in</button>
        </form>
        <form className="flex flex-wrap gap-2" onSubmit={search}>
          <div className="min-w-0 flex-1"><label htmlFor="search-input" className="label">Search by name, X username or ticket</label><input id="search-input" className="input" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <button className="btn-secondary self-end">Search</button>
        </form>
        {matches && (matches.length === 0 ? <p role="status" className="text-ink-muted">No matches.</p> : (
          <ul className="divide-y divide-brand-sky" aria-label="Search results">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div><p className="font-semibold">{m.name} <span className="font-normal text-ink-muted">@{m.x_username}</span></p><p className="font-mono text-xs text-ink-muted">{m.ticket_number}{m.checked_in_at ? " · already checked in" : ""}</p></div>
                <button className="btn-primary" disabled={busy} onClick={() => checkIn(m.ticket_number)}>Check in{" "}<span className="sr-only">{m.name}</span></button>
              </li>
            ))}
          </ul>
        ))}
      </section>
    </div>
  );
}
