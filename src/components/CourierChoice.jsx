import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { friendlyError } from "../lib/api.js";
import { COURIERS, OTHER_COURIER, courierValue, splitCourier } from "../lib/orders.js";
import { useToast } from "./Toast.jsx";
import Alert from "./Alert.jsx";
import Field from "./Field.jsx";
import { IconSave } from "./NavIcons.jsx";

/** The shopper picks the courier they would like for delivery. It can be changed until the order ships. */
export default function CourierChoice({ order, onSaved }) {
  const toast = useToast();
  const start = splitCourier(order.preferred_courier);
  const [choice, setChoice] = useState(start.choice);
  const [other, setOther] = useState(start.other);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (ev) => {
    ev.preventDefault();
    setError("");
    const c = courierValue(choice, other);
    if (c.error) return setError(c.error);
    setBusy(true);
    const { error: err } = await supabase.rpc("set_preferred_courier", { p_order: order.id, p_courier: c.value });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    toast(`Preferred courier saved: ${c.value}`, "success");
    onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-3 border-t border-brand-sky pt-3" noValidate aria-labelledby="courier-pref-h">
      <h3 id="courier-pref-h" className="font-black">Preferred courier</h3>
      <p className="text-ink-muted">Pick the courier you would like us to use. We will try to ship with it. You can change it until your order ships.</p>
      {error && <Alert tone="bad">{error}</Alert>}
      <Field id="pref_courier" label="Courier" required>
        <select className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose a courier…</option>
          {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={OTHER_COURIER}>{OTHER_COURIER}…</option>
        </select>
      </Field>
      {choice === OTHER_COURIER && <Field id="pref_courier_other" label="Courier name" required><input className="input" maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
      <button className="btn-secondary" disabled={busy}><IconSave />{busy ? "Saving…" : order.preferred_courier ? "Update courier" : "Save courier"}</button>
    </form>
  );
}
