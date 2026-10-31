import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { fetchAll } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import DataTable from "../../components/DataTable.jsx";
import { fmtDateTime } from "../../lib/availability.js";

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  const load = () => fetchAll(() => supabase.from("profiles").select("*").order("created_at").order("id")).then(setRows).catch(() => { setRows([]); toast("Could not load users", "error"); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRoleFor = async (u, next) => {
    if (!window.confirm(`${next === "admin" ? "Promote" : "Demote"} ${u.email} ${next === "admin" ? "to admin" : "to attendee"}?`)) return;
    const { error } = await supabase.from("profiles").update({ role: next }).eq("id", u.id);
    if (error) toast(error.message, "error"); else { toast("Role updated", "success"); load(); }
  };

  const shown = useMemo(() => (rows || []).filter((r) => (!role || r.role === role) && (!q || `${r.email} ${r.full_name || ""}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, role]);
  const cols = [
    { key: "full_name", label: "Name", render: (r) => r.full_name || "—" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role", render: (r) => <span className={`badge ${r.role === "admin" ? "badge-info" : "badge-neutral"}`}>{r.role}</span> },
    { key: "created_at", label: "Joined", render: (r) => fmtDateTime(r.created_at) },
    { key: "actions", label: "", sortable: false, render: (r) => r.id === user.id ? <span className="text-xs text-ink-muted">You</span> : r.role === "admin"
      ? <button className="btn-secondary" onClick={() => setRoleFor(r, "attendee")}>Demote{" "}<span className="sr-only">{r.email}</span></button>
      : <button className="btn-secondary" onClick={() => setRoleFor(r, "admin")}>Make admin{" "}<span className="sr-only">{r.email}</span></button> },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Admin users</h1>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search name or email" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[10rem]" aria-label="Role filter" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="admin">Admins</option><option value="attendee">Attendees</option></select>
      </div>
      <DataTable caption="Admin users" columns={cols} rows={shown} loading={rows === null} empty="No users found." />
    </div>
  );
}
