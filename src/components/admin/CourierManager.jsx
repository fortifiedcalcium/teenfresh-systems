import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { COURIER_MAX, validateCourierName } from "../../lib/orders.js";
import { useToast } from "../Toast.jsx";
import { useAnnounce } from "../../a11y.jsx";
import Alert from "../Alert.jsx";
import InputWithAction from "../InputWithAction.jsx";
import { Loading } from "../Spinner.jsx";
import { IconPackage, IconPlus, IconTrash } from "../NavIcons.jsx";

/** Admin: the couriers shoppers and admins can pick from. Orders keep the name they were given, so deleting a courier never changes an old order. */
export default function CourierManager() {
  const toast = useToast();
  const announce = useAnnounce();
  const [list, setList] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);       // the courier waiting for "Yes, delete"
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("couriers").select("id,name").order("id");
    if (err) { toast("Could not load the couriers: " + err.message, "error"); setList([]); return; }
    setList(data || []);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const problem = validateCourierName(name, (list || []).map((c) => c.name));
    if (problem) { setError(problem); announce(problem, "assertive"); return; }
    setBusy(true); setError("");
    const { error: err } = await supabase.from("couriers").insert({ name: name.trim() });
    setBusy(false);
    if (err) { const m = err.code === "23505" ? "That courier already exists." : err.message; setError(m); announce(m, "assertive"); return; }
    announce(`Courier ${name.trim()} added`);
    setName("");
    await load();
  };
  const remove = async (c) => {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("couriers").delete().eq("id", c.id);
    setBusy(false); setConfirm(null);
    if (err) { setError(err.message); return; }
    toast(`Courier ${c.name} deleted`, "success");
    await load();
  };

  return (
    <section className="card space-y-3 p-4" aria-labelledby="couriers-h">
      <h2 id="couriers-h" className="flex items-center gap-2 text-lg font-black"><IconPackage />Couriers</h2>
      <p className="text-sm text-ink-muted">Shoppers choose their courier from this list, and you ship with one of them. "Other" (typing any name) is always offered. Deleting a courier does not change orders that already use it.</p>
      {error && <Alert tone="bad">{error}</Alert>}
      <InputWithAction id="new-courier" label="New courier" hint={`Up to ${COURIER_MAX} characters`} className="input w-64 max-w-full" maxLength={COURIER_MAX} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        action={<button type="button" className="btn-secondary" disabled={busy} onClick={add}><IconPlus />Add courier</button>} />
      {list === null ? <Loading label="Loading couriers…" /> : list.length === 0 ? <p className="text-sm text-ink-muted">No couriers yet. Shoppers can only type a courier name until you add some.</p> : (
        <ul className="space-y-1">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-brand-ivory px-3 py-1 text-sm">
              <span className="font-semibold">{c.name}</span>
              {confirm === c.id ? (
                <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Delete ${c.name}?`}>
                  <span>Delete it from the list?</span>
                  <button type="button" className="btn-danger" disabled={busy} onClick={() => remove(c)}><IconTrash />Yes, delete{" "}<span className="sr-only">{c.name}</span></button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
                </span>
              ) : <button type="button" className="btn-secondary" onClick={() => setConfirm(c.id)}><IconTrash />Delete{" "}<span className="sr-only">courier {c.name}</span></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
