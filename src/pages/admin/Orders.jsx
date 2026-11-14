import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { COURIERS, MAX_TRACKING, OTHER_COURIER, SHIPPING, STATUS, courierValue, sendOrderEmail } from "../../lib/orders.js";
import { productImageUrl, removeProductImage, uploadProductImage } from "../../lib/products.js";
import { IMAGE_TYPES, validateImageFile } from "../../lib/eventImages.js";
import { peso, parseAmount } from "../../lib/payment.js";
import { friendlyError } from "../../lib/api.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import Field from "../../components/Field.jsx";
import Modal from "../../components/Modal.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconBag, IconCheck, IconClose, IconImage, IconPackage, IconSave, IconSend, IconUpload } from "../../components/NavIcons.jsx";

const MAIL_LABEL = { order_received: "Order received (old, no longer sent)", order_paid: "Payment confirmed", order_shipping_due: "Shipping fee to pay", order_shipped: "Shipped", order_cancelled: "Cancelled" };
const FILTERS = [["all", "All"], ["pending", "Awaiting payment check"], ["set_fee", "Set shipping fee"], ["ship_review", "Shipping payment to check"], ["paid", "Paid"], ["shipped", "Shipped"], ["cancelled", "Cancelled"]];

/** Rate, shipping fee and GCash details. */
function SettingsCard() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("shop_settings").select("*").maybeSingle().then(({ data }) => setS({
      gcash_account_name: data?.gcash_account_name || "", gcash_account_number: data?.gcash_account_number || "", gcash_qr_path: data?.gcash_qr_path || null,
    }));
  }, []);
  const [file, setFile] = useState(null);          // a newly chosen QR image, uploaded on Save
  const [removeQr, setRemoveQr] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!s) return <Loading label="Loading settings…" />;
  const shownQr = preview || (!removeQr && s.gcash_qr_path ? productImageUrl({ image_path: s.gcash_qr_path }) : null);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const save = async (ev) => {
    ev.preventDefault(); setError("");
    setSaving(true);
    let newPath = null;
    try { if (file) newPath = await uploadProductImage(file); } catch (e) { setSaving(false); return setError(e.message); }
    const qrPath = newPath || (removeQr ? null : s.gcash_qr_path);
    const { error: err } = await supabase.from("shop_settings").update({ gcash_qr_path: qrPath, gcash_account_name: s.gcash_account_name.trim() || null, gcash_account_number: s.gcash_account_number.trim() || null, updated_at: new Date().toISOString() }).eq("id", true);
    setSaving(false);
    if (err) { if (newPath) await removeProductImage(newPath); setError(err.message); return; }
    if (s.gcash_qr_path && qrPath !== s.gcash_qr_path) await removeProductImage(s.gcash_qr_path);   // tidy up the replaced file
    setS((x) => ({ ...x, gcash_qr_path: qrPath })); setFile(null); setRemoveQr(false);
    toast("Shop settings saved", "success");
  };
  return (
    <form onSubmit={save} className="card space-y-4 p-4" noValidate aria-labelledby="settings-h">
      <h2 id="settings-h" className="text-lg font-black">Checkout settings</h2>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="gcash_account_name" label="GCash account name" hint="Shown to shoppers. Store it masked, for example BR**N CA**O S."><input className="input" value={s.gcash_account_name} onChange={set("gcash_account_name")} /></Field>
        <Field id="gcash_account_number" label="GCash number" hint="Checkout stays closed until this is set"><input className="input" inputMode="numeric" value={s.gcash_account_number} onChange={set("gcash_account_number")} /></Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="label">GCash QR code</legend>
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-40 overflow-hidden rounded-2xl border border-link bg-brand-ivory">
            {shownQr ? <img src={shownQr} alt="GCash QR code preview" className="w-full" />
              : <div className="flex aspect-square w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input ref={inputRef} id="gcash_qr" type="file" accept={Object.keys(IMAGE_TYPES).join(",")} className="file-input sr-only" aria-describedby="gcash_qr-hint"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const bad = validateImageFile(f); if (bad) setError(bad); else { setError(""); setFile(f); setRemoveQr(false); } }} />
            <label htmlFor="gcash_qr" className="btn-secondary cursor-pointer"><IconUpload />{shownQr ? "Replace QR code" : "Choose QR code"}</label>
            {(file || (s.gcash_qr_path && !removeQr)) && <button type="button" className="btn-secondary ml-2" onClick={() => { if (file) setFile(null); else setRemoveQr(true); }}><IconClose />{file ? "Undo choice" : "Remove"}</button>}
            <p id="gcash_qr-hint" className="hint">Shown to shoppers at checkout next to the GCash number. JPG, PNG or WebP. It uploads when you save.</p>
          </div>
        </div>
      </fieldset>
      <div className="flex justify-end"><button className="btn-primary" disabled={saving}><IconSave />{saving ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}

/** A receipt from the private bucket through a short-lived signed URL. */
function Receipt({ path, label = "Payment receipt" }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.storage.from("payment-receipts").createSignedUrl(path, 300).then(({ data, error }) => { if (!alive) return; if (error) setErr("Could not open this receipt."); else setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [path]);
  if (err) return <p className="text-sm font-semibold text-danger">{err}</p>;
  if (!url) return <Loading label="Loading receipt…" className="p-4" />;
  return (
    <figure className="space-y-2">
      {/\.pdf$/i.test(path) ? <p className="rounded-lg bg-brand-sky p-3 text-sm font-semibold">PDF receipt: open it in a new tab to read it.</p>
        : <img src={url} alt={label} className="mx-auto max-h-96 rounded-lg border border-link object-contain" />}
      <figcaption className="text-sm"><a href={url} target="_blank" rel="noopener noreferrer">Open the receipt in a new tab{" "}<span className="sr-only">(link expires in 5 minutes)</span></a></figcaption>
    </figure>
  );
}

function OrderDialog({ order, onClose, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [note, setNote] = useState(order.admin_note || "");
  const [busy, setBusy] = useState(false);
  const [mails, setMails] = useState([]);
  const [fee, setFee] = useState(order.shipping_fee_php == null ? "" : String(order.shipping_fee_php));
  const [reason, setReason] = useState("");
  const [feeError, setFeeError] = useState("");
  useEffect(() => { supabase.from("order_emails").select("*").eq("order_id", order.id).order("sent_at", { ascending: false }).then(({ data }) => setMails(data || [])); }, [order.id]);
  useEffect(() => { supabase.from("order_items").select("*").eq("order_id", order.id).order("title").then(({ data }) => setItems(data || [])); }, [order.id]);
  const [courierChoice, setCourierChoice] = useState(order.courier ? (COURIERS.includes(order.courier) ? order.courier : OTHER_COURIER) : "");
  const [courierOther, setCourierOther] = useState(order.courier && !COURIERS.includes(order.courier) ? order.courier : "");
  const [tracking, setTracking] = useState(order.tracking_number || "");
  const [shipError, setShipError] = useState("");
  /** The courier and tracking number to save, or null (and a message on screen) when they are not valid. */
  const shipment = () => {
    setShipError("");
    const c = courierValue(courierChoice, courierOther);
    if (c.error) { setShipError(c.error); return null; }
    const t = tracking.trim();
    if (t.length > MAX_TRACKING) { setShipError(`The tracking number can be ${MAX_TRACKING} characters at most.`); return null; }
    return { courier: c.value, tracking_number: t || null };
  };
  const saveShipment = async () => {
    const ship = shipment();
    if (!ship) return;
    setBusy(true);
    const { error } = await supabase.from("orders").update({ ...ship, updated_at: new Date().toISOString() }).eq("id", order.id);
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Courier and tracking number saved", "success");
    onChanged();
  };
  const setStatus = async (status) => {
    const ship = status === "shipped" ? shipment() : {};
    if (!ship) return;
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status, ...ship, admin_note: note.trim() || null, updated_at: new Date().toISOString() }).eq("id", order.id);
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    const mail = await sendOrderEmail(`order_${status}`, order.id);
    toast(`Order ${order.order_number}: ${STATUS[status].label}. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}`, mail.ok ? "success" : "error");
    onChanged();
  };
  const sendFee = async () => {
    setFeeError("");
    const amount = parseAmount(fee);
    if (Number.isNaN(amount) || amount > 100000) return setFeeError("Enter the shipping fee in pesos, for example 150 (0 for free shipping).");
    setBusy(true);
    const { error } = await supabase.rpc("set_order_shipping", { p_order: order.id, p_fee: amount });
    if (error) { setBusy(false); toast(friendlyError(error), "error"); return; }
    const mail = amount > 0 ? await sendOrderEmail("order_shipping_due", order.id) : { ok: true };
    setBusy(false);
    toast(amount > 0 ? `Shipping fee ${peso(amount)} set. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}` : "Free shipping set for this order", mail.ok ? "success" : "error");
    onChanged();
  };
  const reviewShipping = async (approve) => {
    setFeeError("");
    if (!approve && !reason.trim()) return setFeeError("Give the shopper a reason, so they know what to fix.");
    setBusy(true);
    const { error } = await supabase.rpc("review_shipping_payment", { p_order: order.id, p_approve: approve, p_note: reason });
    setBusy(false);
    if (error) { toast(friendlyError(error), "error"); return; }
    toast(approve ? "Shipping payment confirmed. You can mark the order as shipped." : "The shipping receipt was sent back to the shopper", "success");
    onChanged();
  };
  const shipOk = order.shipping_status === "paid" || order.shipping_status === undefined;
  const next = { pending: [["paid", "Mark as paid", IconCheck], ["cancelled", "Cancel order", IconClose]], paid: [["shipped", "Mark as shipped", IconPackage], ["cancelled", "Cancel order", IconClose]], shipped: [], cancelled: [] }[order.status] || [];
  return (
    <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="o-ship"><h3 id="o-ship" className="font-black">Deliver to</h3><p>{order.name}<br />{order.address}<br />{order.city} {order.postal_code}<br />{order.phone}<br />{order.email}</p>{order.notes && <p className="mt-1"><span className="font-semibold">Buyer's note:</span> {order.notes}</p>}</section>
          <section aria-labelledby="o-pay"><h3 id="o-pay" className="font-black">Payment to check</h3><p>Expect <strong>{peso(order.total_php)}</strong> ({peso(order.subtotal_php)} items{Number(order.shipping_php) > 0 ? ` plus ${peso(order.shipping_php)} shipping` : ""})<br />Sender: {order.sender_name}<br />Reference: <span className="font-mono">{order.reference_number}</span></p></section>
        </div>
        <ul className="divide-y divide-brand-sky rounded-lg border border-brand-sky px-3">
          {items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span className="break-words">{i.artist}: <strong>{i.title}</strong></span><span className="tabular-nums">{peso(i.unit_price_php)} × {i.quantity}</span></li>)}
        </ul>
        {order.receipt_path ? <Receipt path={order.receipt_path} /> : <p className="text-ink-muted">No receipt file is stored for this order.</p>}
        {order.status === "paid" && order.shipping_status && (
          <section aria-labelledby="o-shipfee" className="space-y-2 rounded-lg border border-brand-sky p-3">
            <h3 id="o-shipfee" className="flex flex-wrap items-center gap-2 font-black">Shipping fee <Badge tone={SHIPPING[order.shipping_status].tone}>{SHIPPING[order.shipping_status].label}</Badge></h3>
            {feeError && <Alert tone="bad">{feeError}</Alert>}
            {(order.shipping_status === "none" || order.shipping_status === "awaiting_payment") && (
              <>
                <p className="text-ink-muted">{order.shipping_status === "none" ? "Set what this shopper pays for shipping. They are emailed and can then pay it from their order page." : "The shopper has not paid yet. You can still change the fee."}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field id="ship_fee" label="Shipping fee (PHP)" hint="0 = free shipping"><input className="input w-40" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
                  <button type="button" className="btn-primary" disabled={busy} onClick={sendFee}><IconSend />{order.shipping_status === "none" ? "Send shipping fee" : "Update fee"}</button>
                </div>
              </>
            )}
            {order.shipping_status === "pending_review" && (
              <>
                <p>Expect <strong>{peso(order.shipping_fee_php)}</strong> · Sender: {order.shipping_sender_name} · Reference: <span className="font-mono">{order.shipping_reference_number}</span></p>
                {order.shipping_receipt_path ? <Receipt path={order.shipping_receipt_path} label="Shipping payment receipt" /> : <p className="text-ink-muted">No receipt file is stored.</p>}
                <Field id="ship_reason" label="Reason (only needed to send it back)" hint="The shopper sees this and can pay again"><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => reviewShipping(true)}><IconCheck />Confirm shipping payment</button>
                  <button type="button" className="btn-danger" disabled={busy} onClick={() => reviewShipping(false)}><IconClose />Send back</button>
                </div>
              </>
            )}
            {order.shipping_status === "paid" && order.shipping_fee_php != null && <p>{Number(order.shipping_fee_php) > 0 ? `${peso(order.shipping_fee_php)} received.` : "Free shipping."} You can mark the order as shipped.</p>}
            {order.shipping_status !== "paid" && order.shipping_status !== undefined && <p className="text-ink-muted">You can mark the order as shipped after the shipping fee is paid.</p>}
          </section>
        )}
        {(order.status === "shipped" || (order.status === "paid" && shipOk)) && (
          <section aria-labelledby="o-courier" className="space-y-2 rounded-lg border border-brand-sky p-3">
            <h3 id="o-courier" className="font-black">Courier and tracking number</h3>
            <p className="text-ink-muted">{order.status === "paid" ? "Fill these in, then press Mark as shipped. The shopper sees them on their order page and in the shipped email." : "The shopper sees these on their order page. You can correct them here."}</p>
            {shipError && <Alert tone="bad">{shipError}</Alert>}
            <div className="grid gap-3 md:grid-cols-2">
              <Field id="courier" label="Courier" required={order.status === "paid"}>
                <select className="input" value={courierChoice} onChange={(e) => setCourierChoice(e.target.value)}>
                  <option value="">Choose a courier…</option>
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={OTHER_COURIER}>{OTHER_COURIER}…</option>
                </select>
              </Field>
              {courierChoice === OTHER_COURIER && <Field id="courier_other" label="Courier name" required><input className="input" maxLength={60} value={courierOther} onChange={(e) => setCourierOther(e.target.value)} /></Field>}
              <Field id="tracking_number" label="Tracking number" hint="Leave empty if the courier gives none"><input className="input" maxLength={MAX_TRACKING} autoComplete="off" value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
            </div>
            {order.status === "shipped" && <div><button type="button" className="btn-secondary" disabled={busy} onClick={saveShipment}><IconSave />Save courier and tracking</button></div>}
          </section>
        )}
        {mails.length > 0 && (
          <section aria-labelledby="o-mail"><h3 id="o-mail" className="font-black">Emails to the shopper</h3>
            <ul className="mt-1 space-y-1">{mails.map((m) => <li key={m.id} className="flex flex-wrap items-center gap-2"><Badge tone={m.status === "sent" ? "ok" : "bad"}>{m.status === "sent" ? "Sent" : "Failed"}</Badge><span>{MAIL_LABEL[m.kind]} · {fmtDateTime(m.sent_at)}{m.error ? ` · ${m.error}` : ""}</span></li>)}</ul>
          </section>
        )}
        <Field id="admin_note" label="Note (only admins see this)"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="sheet-actions flex flex-wrap justify-end gap-2 border-t border-brand-sky">
          <button type="button" className="btn-secondary" onClick={onClose}><IconClose />Close</button>
          {next.map(([s, label, I]) => <button key={s} type="button" className={s === "cancelled" ? "btn-danger" : "btn-primary"} disabled={busy || (s === "shipped" && !shipOk)} onClick={() => setStatus(s)}><I />{label}</button>)}
        </div>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) toast("Could not load the orders: " + error.message, "error");
    setOrders(data || []);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const matches = {
    set_fee: (o) => o.status === "paid" && o.shipping_status === "none",
    ship_review: (o) => o.shipping_status === "pending_review",
  };
  const shown = (orders || []).filter((o) => filter === "all" || (matches[filter] ? matches[filter](o) : o.status === filter));
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl"><IconBag />Shop orders</h1>
      <SettingsCard />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map(([k, l]) => <button key={k} type="button" className="shop-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {orders === null ? <Loading label="Loading orders…" /> : shown.length === 0 ? <Empty>No orders here yet.</Empty> : (
        <ul className="space-y-3">
          {shown.map((o) => {
            const st = STATUS[o.status] || STATUS.pending;
            return (
              <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><h2 className="font-black">{o.order_number} · {o.name}</h2><p className="text-sm text-ink-muted">{fmtDateTime(o.created_at)} · {peso(o.total_php)} · ref {o.reference_number}</p></div>
                <div className="flex items-center gap-3"><Badge tone={st.tone}>{st.label}</Badge>{o.status === "paid" && o.shipping_status && o.shipping_status !== "paid" && <Badge tone={SHIPPING[o.shipping_status].tone}>{SHIPPING[o.shipping_status].label}</Badge>}<button type="button" className="btn-secondary" onClick={() => setOpen(o)}>Review{" "}<span className="sr-only">order {o.order_number}</span></button></div>
              </li>
            );
          })}
        </ul>
      )}
      {open && <OrderDialog order={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}
