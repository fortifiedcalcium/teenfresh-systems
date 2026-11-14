import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { friendlyError } from "../../lib/api.js";
import { balanceStage, sendOrderEmail } from "../../lib/orders.js";
import { parseAmount, peso } from "../../lib/payment.js";
import { useToast } from "../Toast.jsx";
import Alert from "../Alert.jsx";
import Badge from "../Badge.jsx";
import Field from "../Field.jsx";
import Receipt from "./Receipt.jsx";
import { IconCheck, IconClose, IconSend } from "../NavIcons.jsx";

/** Admin: the shopper paid less than they should have. Ask for the remaining amount, then check what they send.
 *  It appears while an order's items payment (pending) or shipping payment (receipt being checked) is open. */
export default function BalanceSection({ order, onChanged }) {
  const toast = useToast();
  const stage = balanceStage(order);                    // "items" | "shipping" | null
  const open = order.balance_status !== "none";
  const [amount, setAmount] = useState(order.balance_due_php ? String(order.balance_due_php) : "");
  const [note, setNote] = useState(order.balance_note || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!stage) return null;

  const expected = stage === "items" ? order.total_php : order.shipping_fee_php;
  const what = stage === "items" ? "the items" : "the shipping fee";

  const request = async (clear = false) => {
    setError("");
    const value = clear ? 0 : parseAmount(amount);
    if (!clear && (Number.isNaN(value) || value <= 0)) return setError("Enter the amount the shopper still has to pay, for example 250.");
    if (!clear && value > Number(expected)) return setError(`That is more than ${what} cost (${peso(expected)}). Enter only what is missing.`);
    setBusy(true);
    const { error: err } = await supabase.rpc("request_balance", { p_order: order.id, p_for: stage, p_amount: value, p_note: note });
    if (err) { setBusy(false); setError(friendlyError(err)); return; }
    const mail = clear ? { ok: true } : await sendOrderEmail("order_balance_due", order.id);
    setBusy(false);
    toast(clear ? "The request was cancelled" : `Asked the shopper for ${peso(value)}. ${mail.ok ? "They were emailed." : "The email could not be sent: " + mail.error}`, clear || mail.ok ? "success" : "error");
    onChanged();
  };
  const review = async (approve) => {
    setError("");
    if (!approve && !reason.trim()) return setError("Give the shopper a reason, so they know what to fix.");
    setBusy(true);
    const { error: err } = await supabase.rpc("review_balance_payment", { p_order: order.id, p_approve: approve, p_note: reason });
    setBusy(false);
    if (err) { setError(friendlyError(err)); return; }
    toast(approve ? "The extra payment is confirmed." : "The receipt was sent back to the shopper", "success");
    onChanged();
  };

  return (
    <section aria-labelledby="o-balance" className="space-y-2 rounded-lg border border-brand-sky p-3">
      <h3 id="o-balance" className="flex flex-wrap items-center gap-2 font-black">Underpaid?
        {order.balance_status === "awaiting_payment" && <Badge tone="warn">Waiting for {peso(order.balance_due_php)}</Badge>}
        {order.balance_status === "pending_review" && <Badge tone="warn">Checking the extra payment</Badge>}
      </h3>
      {error && <Alert tone="bad">{error}</Alert>}

      {order.balance_status !== "pending_review" && (
        <>
          <p className="text-ink-muted">{open ? "The shopper has been asked to pay the amount below. You can change it or cancel the request." : `If the receipt shows less than ${peso(expected)} for ${what}, ask for the missing amount. The shopper is emailed and pays only that amount.`}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="balance_amount" label="Amount still to pay (PHP)" hint={`The order asks for ${peso(expected)} for ${what}`}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field id="balance_note" label="Note for the shopper" hint="Optional, shown on their order"><input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => request(false)}><IconSend />{open ? "Update the amount" : "Ask for the remaining amount"}</button>
            {open && <button type="button" className="btn-secondary" disabled={busy} onClick={() => request(true)}><IconClose />Cancel the request</button>}
          </div>
        </>
      )}

      {order.balance_status === "pending_review" && (
        <>
          <p>Expect <strong>{peso(order.balance_due_php)}</strong> · Sender: {order.balance_sender_name} · Reference: <span className="font-mono">{order.balance_reference_number}</span></p>
          {order.balance_receipt_path ? <Receipt path={order.balance_receipt_path} label="Extra payment receipt" /> : <p className="text-ink-muted">No receipt file is stored.</p>}
          <Field id="balance_reason" label="Reason (only needed to send it back)" hint="The shopper sees this and can pay again"><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => review(true)}><IconCheck />Confirm the extra payment</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => review(false)}><IconClose />Send back</button>
          </div>
        </>
      )}
    </section>
  );
}
