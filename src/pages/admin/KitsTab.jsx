import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { peso } from "../../lib/payment.js";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { IconPlus, IconSave, IconTrash } from "../../components/NavIcons.jsx";

const blank = () => ({ key: crypto.randomUUID(), id: null, name: "", description: "", unit_price: "", max_per_order: "5", active: true });
const toRow = (k) => ({ key: k.id, id: k.id, name: k.name, description: k.description || "", unit_price: String(k.unit_price), max_per_order: String(k.max_per_order), active: k.active });

/** One problem per field, in plain words. The database checks the same limits (and never trusts the browser). */
export function validateKit(r) {
  const e = {};
  if (!r.name.trim()) e.name = "Enter the kit's name";
  else if (r.name.trim().length > 80) e.name = "The name can be 80 characters at most";
  if (!/^\d+(\.\d{1,2})?$/.test(r.unit_price.trim()) || Number(r.unit_price) <= 0) e.unit_price = "Enter a price above 0, with at most 2 decimals";
  if (!/^\d+$/.test(r.max_per_order.trim()) || Number(r.max_per_order) < 1 || Number(r.max_per_order) > 50) e.max_per_order = "Enter a whole number from 1 to 50";
  return e;
}

/** Admin: the kit options of an event. Each has a name, a price per kit, and how many one form may order. */
export default function KitsTab({ event }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [removed, setRemoved] = useState([]);
  const [errors, setErrors] = useState({});     // row key -> { field: message }
  const [submitCount, setSubmitCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [focusSignal, bumpFocus] = useErrorFocus();

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("event_kits").select("*").eq("event_id", event.id).order("sort_order").order("created_at");
    if (error) { toast("Could not load the kits: " + error.message, "error"); setRows([]); return; }
    setRows((data || []).map(toRow)); setRemoved([]); setErrors({});
  }, [event.id, toast]);
  useEffect(() => { load(); }, [load]);

  const set = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (r) => { setRows((rs) => rs.filter((x) => x.key !== r.key)); if (r.id) setRemoved((ids) => [...ids, r.id]); };

  const save = async () => {
    setSubmitCount((n) => n + 1);
    const errs = Object.fromEntries(rows.map((r) => [r.key, validateKit(r)]).filter(([, e]) => Object.keys(e).length));
    setErrors(errs);
    if (Object.keys(errs).length) { bumpFocus(); return; }
    setSaving(true);
    try {
      if (removed.length) { const { error } = await supabase.from("event_kits").delete().in("id", removed); if (error) throw error; }
      for (const [i, r] of rows.entries()) {
        const row = { event_id: event.id, name: r.name.trim(), description: r.description.trim() || null, unit_price: Number(r.unit_price), max_per_order: Number(r.max_per_order), active: r.active, sort_order: i };
        const { error } = r.id ? await supabase.from("event_kits").update(row).eq("id", r.id) : await supabase.from("event_kits").insert(row);
        if (error) throw error;
      }
      toast("Kits saved", "success");
      await load();
    } catch (e) { toast(e.message || "Could not save the kits", "error"); }
    finally { setSaving(false); }
  };

  if (!rows) return <Loading label="Loading kits…" />;
  const flat = rows.flatMap((r, i) => Object.entries(errors[r.key] || {}).map(([f, message]) => [`kit${i}-${f}`, { message: `Kit ${i + 1}: ${message}` }]));
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Add the kits people can order. Each form picks one kit and a quantity, and pays <strong>quantity × price</strong>. With no kits, the event uses its single registration fee. Orders already placed keep the price they were placed at, so changing a price only affects new orders. A switched-off kit disappears from the form but stays on old orders.</p>
      <ErrorSummary errors={Object.fromEntries(flat)} submitCount={submitCount} focusSignal={focusSignal} />
      {rows.length === 0 && <Alert tone="info">No kits yet. Add one, or leave it empty to use the flat registration fee.</Alert>}
      <ul className="space-y-4">
        {rows.map((r, i) => {
          const e = errors[r.key] || {};
          const f = (name) => `kit${i}-${name}`;
          const field = (name, label, props, hint) => (
            <div>
              <label htmlFor={f(name)} className="label">{label}</label>
              <input id={f(name)} className="input" value={r[name]} onChange={(ev) => set(r.key, name, ev.target.value)} aria-invalid={e[name] ? "true" : undefined} aria-describedby={e[name] ? `${f(name)}-err` : hint ? `${f(name)}-hint` : undefined} {...props} />
              {hint && !e[name] && <p id={`${f(name)}-hint`} className="hint">{hint}</p>}
              {e[name] && <p id={`${f(name)}-err`} className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{e[name]}</p>}
            </div>
          );
          return (
            <li key={r.key}>
              <fieldset className="card space-y-3 p-4">
                <legend className="px-1 text-lg font-bold">Kit {i + 1}{r.name ? `: ${r.name}` : ""}</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {field("name", "Name (required)", { maxLength: 80 })}
                  {field("unit_price", "Price per kit, PHP (required)", { inputMode: "decimal" }, r.unit_price && !e.unit_price && Number(r.unit_price) > 0 ? `${peso(r.unit_price)} each` : "Amount per kit, for example 100")}
                  {field("max_per_order", "Most one form can order (required)", { inputMode: "numeric" }, "A whole number from 1 to 50")}
                </div>
                <div>
                  <label htmlFor={f("description")} className="label">Description</label>
                  <textarea id={f("description")} className="input" rows={2} value={r.description} onChange={(ev) => set(r.key, "description", ev.target.value)} />
                  <p className="hint">What is in the kit, for example (1) Cupsleeve, (1) Trading Card</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={r.active} onChange={(ev) => set(r.key, "active", ev.target.checked)} /> Available on the registration form</label>
                  <button type="button" className="btn-secondary" onClick={() => remove(r)}><IconTrash />Remove{" "}<span className="sr-only">kit {i + 1}{r.name ? `, ${r.name}` : ""}</span></button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <div className="sheet-actions flex flex-wrap justify-between gap-2 border-t border-brand-sky">
        <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, blank()])}><IconPlus />Add a kit</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}><IconSave />{saving ? "Saving…" : "Save kits"}</button>
      </div>
    </div>
  );
}
