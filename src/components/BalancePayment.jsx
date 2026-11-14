import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { friendlyError } from "../lib/api.js";
import { isValidReference, normalizeReference, peso, receiptPath, validateReceiptFile } from "../lib/payment.js";
import { productImageUrl } from "../lib/products.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useShopSettings } from "../lib/useShop.js";
import Alert from "./Alert.jsx";
import CopyButton from "./CopyButton.jsx";
import Field from "./Field.jsx";
import FileUpload from "./FileUpload.jsx";
import { IconSend } from "./NavIcons.jsx";

/** The shopper paid less than the order asks for. They see how much is missing and send a receipt for just that amount. */
export default function BalancePayment({ order, onSent }) {
  const { user } = useAuth();
  const settings = useShopSettings();
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const what = order.balance_for === "shipping" ? "shipping fee" : "order";

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const errs = {};
    if (!sender.trim()) errs.sender = "Enter the name on the GCash account you paid from";
    if (!isValidReference(reference)) errs.reference = "Enter the reference number exactly as GCash shows it";
    const fileProblem = validateReceiptFile(file);
    if (fileProblem) errs.receipt = fileProblem;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    let path = null;
    try {
      path = receiptPath(user.id, file);
      const up = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error("We couldn't upload your receipt. Check your connection and the file, then try again.");
      const { error } = await supabase.rpc("submit_balance_payment", { p_order: order.id, p_sender: sender.trim(), p_reference: normalizeReference(reference), p_receipt_path: path });
      if (error) throw error;
      onSent();
    } catch (e) {
      if (path) supabase.storage.from("payment-receipts").remove([path]);      // do not leave an unused receipt behind
      setServerError(friendlyError(e)); setBusy(false);
    }
  };

  const qr = settings?.gcash_qr_path ? productImageUrl({ image_path: settings.gcash_qr_path }) : null;
  return (
    <section className="card space-y-4 p-4" aria-labelledby="balance-h">
      <h2 id="balance-h" className="text-lg font-black">Your payment was short: send the remaining {peso(order.balance_due_php)}</h2>
      <Alert tone="warn"><span>We received less than the total for your {what}. <strong>Send only the missing {peso(order.balance_due_php)}</strong> by GCash. You do not need to pay the full amount again.{order.balance_note ? <> <span className="font-semibold">Note from us:</span> {order.balance_note}</> : null}</span></Alert>
      <div className="rounded-lg bg-brand-sky p-3 text-sm">
        <p>Send <strong>{peso(order.balance_due_php)}</strong> to:</p>
        {settings?.gcash_account_number && (
          <>
            <p className="mt-1 font-bold">{settings.gcash_account_name || "Teenfresh"}</p>
            <p className="flex flex-wrap items-center gap-2"><span className="font-mono text-base font-bold">{settings.gcash_account_number}</span><CopyButton text={settings.gcash_account_number} label="Copy GCash number" /></p>
          </>
        )}
        {qr && (
          <figure className="mt-3 w-48 max-w-full">
            <img src={qr} alt={`GCash QR code for ${settings.gcash_account_name || "Teenfresh"}. Scan it in the GCash app to pay.`} className="w-full rounded-lg border border-link bg-white" />
            <figcaption className="mt-1 text-sm">Or scan this QR code in the GCash app.</figcaption>
          </figure>
        )}
        <p className="mt-2">Then enter the details below and attach the receipt for this extra payment.</p>
      </div>
      {serverError && <Alert tone="bad">{serverError}</Alert>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="bal_sender" label="GCash sender name" required error={errors.sender} hint="The name on the account you paid from"><input className="input" value={sender} onChange={(e) => setSender(e.target.value)} /></Field>
          <Field id="bal_reference" label="Reference number" required error={errors.reference}><input className="input" autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        <FileUpload id="bal_receipt" file={file} onChange={setFile} error={errors.receipt} />
        <div className="flex justify-end"><button className="btn-primary" disabled={busy}><IconSend />{busy ? "Sending…" : "Send the extra payment"}</button></div>
      </form>
    </section>
  );
}
