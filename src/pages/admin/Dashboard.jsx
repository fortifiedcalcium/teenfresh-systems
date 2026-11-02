import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { fetchAll } from "../../lib/api.js";
import { fmtDateTime } from "../../lib/availability.js";
import { Empty, Loading } from "../../components/Spinner.jsx";
import Badge from "../../components/Badge.jsx";
import { peso } from "../../lib/payment.js";
import { IconCheckCircle, IconClock, IconDashboard, IconInbox, IconPercent, IconTicket, IconUserCheck, IconUsers, IconWallet, IconXCircle } from "../../components/NavIcons.jsx";

const Stat = ({ label, value, sub, icon: Icon, tone = "text-ink" }) => (
  <div className="card p-4"><dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">{Icon && <Icon />}{label}</dt><dd className={`mt-1 text-3xl font-extrabold ${tone}`}>{value}</dd>{sub && <dd className="text-xs text-ink-muted">{sub}</dd>}</div>
);

/** Bar chart: bars are `link` or `brand-blue` + a 2px ink outline (3:1 non-text contrast), every bar prints its value,
 *  and a real table below carries the same data for screen readers (1.1.1 / 1.4.11). */
function Bars({ data, title, fill }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="flex h-36 items-end gap-1" aria-hidden="true">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="text-xs font-bold">{d.value || ""}</span>
            <div className={`chart-bar w-full rounded-t ${d.value ? `border-2 border-ink ${fill}` : "border-b-2 border-ink"}`} style={{ height: `${(d.value / max) * 85}%`, minHeight: d.value ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-xs text-ink-muted" aria-hidden="true">{data.map((d, i) => <span key={d.label} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{data.length > 8 && i % 4 ? "" : d.label}</span>)}</div>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-target items-center font-semibold text-link underline">View data table</summary>
        <div className="overflow-x-auto"><table className="mt-2 w-full">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col" className="th">Period</th><th scope="col" className="th">Count</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><th scope="row" className="td text-left font-normal">{d.label}</th><td className="td">{d.value}</td></tr>)}</tbody>
        </table></div>
      </details>
    </figure>
  );
}

export default function Dashboard() {
  const { event } = useOutletContext();
  const [rows, setRows] = useState(null);
  const [recent, setRecent] = useState([]);
  const [verifiedAmount, setVerifiedAmount] = useState(0);

  const load = useCallback(async () => {
    if (!event) return;
    const [all, rec, pays] = await Promise.all([
      fetchAll(() => supabase.from("registrations").select("id,status,created_at,checked_in_at,kit_name,kit_quantity").eq("event_id", event.id).order("created_at").order("id")),
      supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,checker:profiles!registrations_checked_in_by_fkey(full_name,email)").eq("event_id", event.id).not("checked_in_at", "is", null).order("checked_in_at", { ascending: false }).limit(8),
      fetchAll(() => supabase.from("payments").select("id,amount_paid").eq("event_id", event.id).eq("status", "verified").order("id")),
    ]);
    setRows(all); setRecent(rec.data || []); setVerifiedAmount(pays.reduce((a, p) => a + Number(p.amount_paid), 0));
  }, [event]);

  useEffect(() => {
    setRows(null); load();
    if (!event) return;
    // Realtime: any registration change for this event refreshes the numbers (admins pass RLS)
    const ch = supabase.channel("dash-" + event.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `event_id=eq.${event.id}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [event, load]);

  const m = useMemo(() => {
    if (!rows) return null;
    const confirmed = rows.filter((r) => r.status === "confirmed");
    const pending = rows.filter((r) => r.status === "pending_verification");
    const rejected = rows.filter((r) => r.status === "rejected");
    const used = confirmed.length + pending.length;   // pending forms hold a slot too
    // kits to prepare: quantity ordered per kit, split into confirmed and still-pending orders
    const kitMap = new Map();
    [...confirmed.map((r) => [r, "confirmed"]), ...pending.map((r) => [r, "pending"])].forEach(([r, k]) => { if (!r.kit_name) return; const e = kitMap.get(r.kit_name) || { name: r.kit_name, confirmed: 0, pending: 0 }; e[k] += r.kit_quantity || 1; kitMap.set(r.kit_name, e); });
    const checked = confirmed.filter((r) => r.checked_in_at);
    const byDay = new Map();
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); byDay.set(d.toISOString().slice(0, 10), 0); }
    confirmed.forEach((r) => { const k = r.created_at.slice(0, 10); if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1); });
    const byHour = new Map();
    checked.forEach((r) => { const h = new Date(r.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "Asia/Manila" }); byHour.set(h, (byHour.get(h) || 0) + 1); });
    return {
      registered: used, confirmed: confirmed.length, pending: pending.length, rejected: rejected.length, checked: checked.length, remaining: Math.max(event.capacity - used, 0),
      rate: confirmed.length ? Math.round((checked.length / confirmed.length) * 100) : 0,
      kits: [...kitMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      days: [...byDay].map(([k, v]) => ({ label: k.slice(5), value: v })),
      hours: [...byHour].map(([k, v]) => ({ label: k, value: v })),
    };
  }, [rows, event]);

  if (!event) return <Empty>Create an event first (Events page).</Empty>;
  if (!m) return <Loading label="Loading dashboard…" className="p-12" logo />;
  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl"><IconDashboard />Dashboard</h1><p className="text-ink-muted">{event.title}</p></div>
      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="sr-only">Key numbers</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={IconUsers} label="Capacity" value={event.capacity} />
          <Stat icon={IconTicket} label="Slots used" value={m.registered} sub={`${Math.round((m.registered / event.capacity) * 100)}% full (pending + confirmed)`} />
          <Stat icon={IconClock} label="Pending verification" value={m.pending} tone={m.pending ? "text-warning-ink" : "text-ink"} sub="payments to review" />
          <Stat icon={IconCheckCircle} label="Confirmed" value={m.confirmed} tone="text-success" />
          <Stat icon={IconXCircle} label="Rejected" value={m.rejected} tone={m.rejected ? "text-danger" : "text-ink"} />
          <Stat icon={IconWallet} label="Total verified" value={peso(verifiedAmount)} sub="payments marked verified" />
          <Stat icon={IconUserCheck} label="Checked in" value={m.checked} tone="text-success" />
          <Stat icon={IconInbox} label="Slots remaining" value={m.remaining} tone={m.remaining === 0 ? "text-danger" : "text-ink"} />
          <Stat icon={IconPercent} label="Check-in rate" value={`${m.rate}%`} sub="of confirmed" />
        </dl>
      </section>
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-4" aria-labelledby="c1"><h2 id="c1" className="mb-3 text-lg">Registrations, last 14 days</h2><Bars data={m.days} title="Registrations per day, last 14 days" fill="bg-link" /></section>
        <section className="card p-4" aria-labelledby="c2"><h2 id="c2" className="mb-3 text-lg">Check-ins by hour</h2>{m.hours.length ? <Bars data={m.hours} title="Check-ins per hour" fill="bg-brand-blue" /> : <p className="py-10 text-center text-ink-muted">No check-ins yet.</p>}</section>
      </div>
      {m.kits.length > 0 && (
        <section className="card p-4" aria-labelledby="kits-h">
          <h2 id="kits-h" className="mb-3 text-lg">Kits ordered</h2>
          {/* a scrollable region must be keyboard-focusable (axe: scrollable-region-focusable), so tabIndex is intentional */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div role="region" aria-label="Kits ordered (scrollable)" tabIndex={0} className="relative overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Kits ordered, by kit</caption>
              <thead><tr><th scope="col" className="th">Kit</th><th scope="col" className="th">Confirmed</th><th scope="col" className="th">Pending verification</th><th scope="col" className="th">Total</th></tr></thead>
              <tbody className="divide-y divide-brand-sky">{m.kits.map((k) => <tr key={k.name}><th scope="row" className="td text-left font-semibold">{k.name}</th><td className="td">{k.confirmed}</td><td className="td">{k.pending}</td><td className="td font-bold">{k.confirmed + k.pending}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card p-4" aria-labelledby="rc">
        <h2 id="rc" className="mb-3 flex items-center gap-2 text-lg">Recent check-ins <Badge tone="ok">Live updates</Badge></h2>
        {recent.length === 0 ? <p className="text-ink-muted">No check-ins yet.</p> : (
          <ul className="divide-y divide-brand-sky">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{r.name}</strong> <span className="text-ink-muted">@{r.x_username}</span> · <span className="font-mono">{r.ticket_number}</span></span>
                <span className="text-ink-muted">{fmtDateTime(r.checked_in_at)}{r.checker ? ` · ${r.checker.full_name || r.checker.email}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
