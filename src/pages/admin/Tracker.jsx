import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { fetchAll } from "../../lib/api.js";
import { downloadCsv } from "../../lib/csv.js";
import { fmtDateTime } from "../../lib/availability.js";
import DataTable from "../../components/DataTable.jsx";
import { Empty } from "../../components/Spinner.jsx";
import { IconChecklist, IconDownload, IconHistory } from "../../components/NavIcons.jsx";

const RESULT_BADGE = { success: "badge-ok", duplicate: "badge-warn", invalid: "badge-bad" };

export default function Tracker() {
  const { event } = useOutletContext();
  const [tab, setTab] = useState("list");
  const [rows, setRows] = useState(null);
  const [logs, setLogs] = useState(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!event) return;
    setRows(await fetchAll(() => supabase.from("registrations").select("id,name,x_username,ticket_number,checked_in_at,kit_claimed,receipt_verified,checker:profiles!registrations_checked_in_by_fkey(full_name,email)").eq("event_id", event.id).eq("status", "confirmed").order("created_at").order("id")));
    const { data } = await supabase.from("attendance_logs").select("id,ticket_number_scanned,result,scanned_at,registrations(name,event_id),scanner:profiles!attendance_logs_scanned_by_fkey(full_name,email)").order("scanned_at", { ascending: false }).limit(300);
    setLogs(data || []);
  }, [event]);

  useEffect(() => {
    setRows(null); load();
    if (!event) return;
    const ch = supabase.channel("track-" + event.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `event_id=eq.${event.id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [event, load]);

  const counts = useMemo(() => { const r = rows || []; const c = r.filter((x) => x.checked_in_at).length; return { total: r.length, in: c, out: r.length - c }; }, [rows]);
  const shown = useMemo(() => (rows || []).filter((r) => (filter === "in" ? r.checked_in_at : filter === "out" ? !r.checked_in_at : true) && (!q || `${r.name} ${r.x_username} ${r.ticket_number}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);
  const staff = (r) => r.checker?.full_name || r.checker?.email || "";

  const exportCsv = () => downloadCsv(`attendance-${event.ticket_prefix}.csv`, ["Ticket", "Name", "X username", "Status", "Checked in at", "Checked in by", "Receipt verified", "Kit claimed"],
    shown.map((r) => [r.ticket_number, r.name, "@" + r.x_username, r.checked_in_at ? "Checked in" : "Not yet arrived", fmtDateTime(r.checked_in_at), staff(r), r.receipt_verified ? "Yes" : "No", r.kit_claimed ? "Yes" : "No"]));

  if (!event) return <Empty>Create an event first.</Empty>;
  const cols = [
    { key: "ticket_number", label: "Ticket", className: "font-mono whitespace-nowrap" },
    { key: "name", label: "Name" },
    { key: "x_username", label: "X", render: (r) => "@" + r.x_username },
    { key: "status", label: "Status", sortValue: (r) => (r.checked_in_at ? 1 : 0), render: (r) => <span className={`badge ${r.checked_in_at ? "badge-ok" : "badge-neutral"}`}>{r.checked_in_at ? "Checked in" : "Not yet arrived"}</span> },
    { key: "checked_in_at", label: "Time", className: "whitespace-nowrap", render: (r) => fmtDateTime(r.checked_in_at) || "—" },
    { key: "staff", label: "Scanned by", sortValue: staff, render: (r) => staff(r) || "—" },
    { key: "receipt_verified", label: "Receipt", sortValue: (r) => +r.receipt_verified, render: (r) => (r.receipt_verified ? "✓" : "—") },
    { key: "kit_claimed", label: "Kit", sortValue: (r) => +r.kit_claimed, render: (r) => (r.kit_claimed ? "✓" : "—") },
  ];
  const logCols = [
    { key: "scanned_at", label: "When", className: "whitespace-nowrap", render: (l) => fmtDateTime(l.scanned_at) },
    { key: "result", label: "Result", render: (l) => <span className={`badge ${RESULT_BADGE[l.result]}`}>{l.result}</span> },
    { key: "ticket_number_scanned", label: "Ticket scanned", className: "font-mono" },
    { key: "who", label: "Attendee", sortValue: (l) => l.registrations?.name || "", render: (l) => l.registrations?.name || "—" },
    { key: "scanner", label: "Scanned by", sortValue: (l) => l.scanner?.full_name || l.scanner?.email || "", render: (l) => l.scanner?.full_name || l.scanner?.email || "—" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="flex items-center gap-2 text-2xl"><IconChecklist />Attendance</h1><span className="badge badge-ok">Live updates</span></div>
        {tab === "list" && <button className="btn-primary" onClick={exportCsv} disabled={!shown.length}><IconDownload />Export CSV</button>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-3"><p className="text-2xl font-extrabold">{counts.total}</p><p className="text-xs text-ink-muted">Registered</p></div>
        <div className="card p-3"><p className="text-2xl font-extrabold text-success">{counts.in}</p><p className="text-xs text-ink-muted">Checked in</p></div>
        <div className="card p-3"><p className="text-2xl font-extrabold text-warning-ink">{counts.out}</p><p className="text-xs text-ink-muted">Not yet arrived</p></div>
      </div>
      <div className="flex gap-2" role="tablist">
        {[["list", "Attendance list", IconChecklist], ["log", "Scan audit log", IconHistory]].map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "btn-primary" : "btn-secondary"} onClick={() => setTab(k)}><I />{l}</button>)}
      </div>
      {tab === "list" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-xs" placeholder="Search name, X or ticket" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input max-w-[12rem]" aria-label="Attendance filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Everyone</option><option value="in">Checked in</option><option value="out">Not yet arrived</option></select>
          </div>
          <DataTable caption="Attendance list" columns={cols} rows={shown} loading={rows === null} empty="No attendees match." pageSize={50} initialSort={{ key: "checked_in_at", dir: "desc" }} />
        </>
      ) : (
        <DataTable caption="Scan audit log" columns={logCols} rows={(logs || []).filter((l) => !l.registrations || l.registrations.event_id === event.id)} loading={logs === null} empty="No scans yet." pageSize={50} />
      )}
    </div>
  );
}
