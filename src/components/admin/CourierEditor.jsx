import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { OTHER_COURIER, courierValue, splitCourier } from "../../lib/orders.js";
import { useCouriers } from "../../lib/useShop.js";
import { useToast } from "../Toast.jsx";
import Alert from "../Alert.jsx";
import Field from "../Field.jsx";
import { IconSave } from "../NavIcons.jsx";

/** Admin: change the courier of an order that has not shipped yet (for example when the shopper's choice cannot deliver there).
 *  The shopper sees the new courier. Once the shipping fee is set, only an admin can change it. */
export default function CourierEditor({ order, onSaved }) {
  const toast = useToast();
  const couriers = useCouriers();
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  // start from the courier already on the order, once the list has loaded (a name that is no longer in the list shows as "Other")
  useEffect(() => { if (!couriers) return; const s = splitCourier(order.preferred_courier, couriers); setChoice(s.choice); setOther(s.other); }, [couriers, order.preferred_courier]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = order.shipping_status !== "none";

  const save = async () => {
    setError("");
    const c = courierValue(choice, other);
    if (c.error) return setError(c.error);
    if (c.value === (order.preferred_courier || "")) return setError("That is already the courier on this order.");
    setBusy(true);
    const { error: err } = await supabase.from("orders").update({ preferred_courier: c.value, updated_at: new Date().toISOString() }).eq("id", order.id);
    setBusy(false);
    if (err) return setError(err.message);
    toast(`Courier changed to ${c.value}`, "success");
    onSaved();
  };

  return (
    <section aria-labelledby="o-courier-edit" className="space-y-2 rounded-lg border border-brand-sky p-3">
      <h3 id="o-courier-edit" className="font-black">Courier</h3>
      <p className="text-ink-muted">
        {order.preferred_courier ? <>The shopper chose <strong>{order.preferred_courier}</strong>. </> : "The shopper has not chosen a courier yet. "}
        {locked ? "The shipping fee is already set, so the shopper can no longer change it. You still can." : "The shopper can still change it until you set the shipping fee."}
      </p>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="edit_courier" label="Courier">
          <select className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose a courier…</option>
            {(couriers || []).map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER_COURIER}>{OTHER_COURIER}…</option>
          </select>
        </Field>
        {choice === OTHER_COURIER && <Field id="edit_courier_other" label="Courier name"><input className="input" maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
      </div>
      <div><button type="button" className="btn-secondary" disabled={busy} onClick={save}><IconSave />Save courier</button></div>
    </section>
  );
}
