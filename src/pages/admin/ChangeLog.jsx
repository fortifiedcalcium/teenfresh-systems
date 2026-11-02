import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { useToast } from "../../components/Toast.jsx";
import DataTable from "../../components/DataTable.jsx";
import FilterBar from "../../components/FilterBar.jsx";
import Alert from "../../components/Alert.jsx";
import { fmtDateTime } from "../../lib/availability.js";
import { IconHistory } from "../../components/NavIcons.jsx";

const AREAS = { events: "Event", event_kits: "Kit", email_templates: "Email template", registrations: "Registration", payments: "Payment", profiles: "User role" };
const VERBS = { insert: "Created", update: "Updated", delete: "Deleted" };

/** One readable line per change: "status: pending → verified". */
export function describe(row) {
  const c = row.changes || {};
  const parts = Object.entries(c).map(([k, v]) => {
    const name = k.replace(/_/g, " ");
    if (v && typeof v === "object" && "new" in v) return `${name}: ${v.old ?? "empty"} → ${v.new ?? "empty"}`;
    return row.action === "update" ? `${name} changed` : `${name}: ${v ?? "empty"}`;
  });
  return parts.length ? parts.join("; ") : "—";
}

export default function ChangeLog() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("change_log").select("*").order("at", { ascending: false }).order("id", { ascending: false }).limit(1000)
      .then(({ data, error }) => {
        if (error) { setFailed(true); setRows([]); toast("Could not load the change log", "error"); } else setRows(data || []);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (rows || []).filter((r) => (!area || r.table_name === area)
    && (!q || `${r.label || ""} ${r.actor_email || ""} ${describe(r)}`.toLowerCase().includes(q.toLowerCase()))), [rows, area, q]);

  const cols = [
    { key: "at", label: "When", render: (r) => fmtDateTime(r.at) },
    { key: "actor_email", label: "Who", render: (r) => r.actor_email || "System / SQL editor" },
    { key: "table_name", label: "Area", render: (r) => AREAS[r.table_name] || r.table_name },
    { key: "action", label: "Action", render: (r) => <span className={`badge ${r.action === "delete" ? "badge-bad" : r.action === "insert" ? "badge-ok" : "badge-info"}`}>{VERBS[r.action]}</span> },
    { key: "label", label: "Item", render: (r) => r.label || "—" },
    { key: "changes", label: "What changed", sortable: false, className: "max-w-md break-words whitespace-normal", render: describe },
  ];
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-black"><IconHistory />Change log</h1>
      <p className="text-sm text-ink-muted">Who changed what, newest first (the latest 1,000 changes). Contact details and payment references are recorded as “changed” without their values. Entries cannot be edited or deleted.</p>
      {failed && <Alert tone="bad"><strong>The change log is not set up yet.</strong> Run <code>004_change_log.sql</code> in the Supabase SQL Editor for this project, then reload.</Alert>}
      <FilterBar activeCount={area ? 1 : 0}
        search={<input className="input w-full md:w-72" placeholder="Search item, person or change" aria-label="Search the change log" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <select className="input max-w-[12rem]" aria-label="Area filter" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All areas</option>
          {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </FilterBar>
      <DataTable caption="Change log" columns={cols} rows={shown} rowKey="id" loading={rows === null} empty="No changes recorded yet." initialSort={{ key: "at", dir: "desc" }} />
    </div>
  );
}
