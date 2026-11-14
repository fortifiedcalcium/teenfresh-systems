import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { MAX_TRACKING, OTHER_COURIER, SHIPPING, STATUS, courierValue, displayStatus, isFullyPaid, sendOrderEmail, splitCourier } from "../../lib/orders.js";
import { productImageUrl, removeProductImage, uploadProductImage } from "../../lib/products.js";
import { IMAGE_TYPES, validateImageFile } from "../../lib/eventImages.js";
import { peso, parseAmount } from "../../lib/payment.js";
import { friendlyError } from "../../lib/api.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import OrderStatusBadge from "../../components/OrderStatusBadge.jsx";
import CourierEditor from "../../components/admin/CourierEditor.jsx";
import Receipt from "../../components/admin/Receipt.jsx";
import BalanceSection from "../../components/admin/BalanceSection.jsx";
import BusyOverlay from "../../components/BusyOverlay.jsx";
import InputWithAction from "../../components/InputWithAction.jsx";
import { useLiveReload } from "../../hooks/useLiveReload.js";
import CourierManager from "../../components/admin/CourierManager.jsx";
import { useCouriers } from "../../lib/useShop.js";
import Field from "../../components/Field.jsx";
import Modal from "../../components/Modal.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconBag, IconCheck, IconClose, IconImage, IconPackage, IconSave, IconSend, IconTrash, IconUpload } from "../../components/NavIcons.jsx";

const MAIL_LABEL = { order_received: "Order received (old, no longer sent)", order_paid: "Payment confirmed", order_balance_due: "Payment short: remaining amount", order_shipping_due: "Shipping fee to pay", order_shipped: "Shipped", order_cancelled: "Cancelled" };
const FILTERS = [["all", "All"], ["pending", "Awaiting payment"], ["set_fee", "Set shipping fee"], ["underpaid", "Underpaid"], ["ship_review", "Shipping payment to check"], ["paid", "Paid"], ["shipped", "Shipped"], ["cancelled", "Cancelled"]];

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
          <div className="min-w-[12rem] flex-1 space-y-2">
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

function OrderDialog({ order, onClose, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [note, setNote] = useState(order.admin_note || "");
  const [busy, setBusy] = useState(false);
  const [mails, setMails] = useState([]);
  const [fee, setFee] = useState(order.shipping_fee_php == null ? "" : String(order.shipping_fee_php));
  const [reason, setReason] = useState("");
  const [feeError, setFeeError] = useState("");
  const [sending, setSending] = useState(false);          // an email is on its way: show the loading screen
  useEffect(() => { supabase.from("order_emails").select("*").eq("order_id", order.id).order("sent_at", { ascending: false }).then(({ data }) => setMails(data || [])); }, [order.id]);
  useEffect(() => { supabase.from("order_items").select("*").eq("order_id", order.id).order("title").then(({ data }) => setItems(data || [])); }, [order.id]);
  const couriers = useCouriers();
  const [courierChoice, setCourierChoice] = useState("");
  const [courierOther, setCourierOther] = useState("");
  // start from the courier already used, else what the shopper asked for, once the list has loaded
  useEffect(() => { if (!couriers) return; const s = splitCourier(order.courier || order.preferred_courier, couriers); setCourierChoice(s.choice); setCourierOther(s.other); }, [couriers, order.courier, order.preferred_courier]);
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
  /** Once everything is paid the receipts are not needed: delete the files and keep only the reference numbers. Returns false if it could not. */
  const purgeReceipts = async () => {
    const paths = [order.receipt_path, order.shipping_receipt_path, order.balance_receipt_path].filter(Boolean);
    if (!paths.length) return true;
    const { error } = await supabase.storage.from("payment-receipts").remove(paths);
    if (error) return false;
    const { error: e2 } = await supabase.from("orders").update({ receipt_path: null, shipping_receipt_path: null, balance_receipt_path: null }).eq("id", order.id);
    return !e2;
  };
  const warnPurge = (ok) => { if (!ok) toast("The receipt files could not be deleted. Open the order again and press Delete receipt files.", "error"); };
  const deleteLeftover = async () => {
    setBusy(true);
    const ok = await purgeReceipts();
    setBusy(false);
    if (!ok) { toast("The receipt files could not be deleted. Try again.", "error"); return; }
    toast("Receipt files deleted. Only the reference numbers are kept.", "success");
    onChanged();
  };
  const setStatus = async (status) => {
    const ship = status === "shipped" ? shipment() : {};
    if (!ship) return;
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status, ...ship, admin_note: note.trim() || null, updated_at: new Date().toISOString() }).eq("id", order.id);
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    if (status === "paid" && isFullyPaid({ ...order, status })) warnPurge(await purgeReceipts());      // nothing left to pay (free shipping, or an older order)
    setSending(true);
    const mail = await sendOrderEmail(`order_${status}`, order.id);
    setSending(false);
    toast(`Order ${order.order_number}: ${status === "paid" && !isFullyPaid({ ...order, status }) ? "payment confirmed, the shipping fee is next" : STATUS[status].label}. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}`, mail.ok ? "success" : "error");
    onChanged();
  };
  const sendFee = async () => {
    setFeeError("");
    const amount = parseAmount(fee);
    if (Number.isNaN(amount) || amount > 100000) return setFeeError("Enter the shipping fee in pesos, for example 150 (0 for free shipping).");
    setBusy(true);
    const { error } = await supabase.rpc("set_order_shipping", { p_order: order.id, p_fee: amount });
    if (error) { setBusy(false); toast(friendlyError(error), "error"); return; }
    if (amount === 0 && order.status === "paid") warnPurge(await purgeReceipts());                  // free shipping: everything is paid now
    setSending(amount > 0);
    const mail = amount > 0 ? await sendOrderEmail("order_shipping_due", order.id) : { ok: true };
    setSending(false);
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
    if (approve && order.status === "paid") warnPurge(await purgeReceipts());                       // the shipping fee is paid too: everything is paid
    toast(approve ? "Shipping payment confirmed. You can mark the order as shipped." : "The shipping receipt was sent back to the shopper", "success");
    onChanged();
  };
  const shipOk = order.shipping_status === "paid" || order.shipping_status === undefined;
  const fullyPaid = isFullyPaid(order);
  const leftoverReceipts = Boolean(order.receipt_path || order.shipping_receipt_path || order.balance_receipt_path);
  const balanceOpen = Boolean(order.balance_status) && order.balance_status !== "none";
  const next = { pending: [["paid", "Mark as paid", IconCheck], ["cancelled", "Cancel order", IconClose]], paid: [["shipped", "Mark as shipped", IconPackage], ["cancelled", "Cancel order", IconClose]], shipped: [], cancelled: [] }[order.status] || [];
  return (
    <Modal title={`Order ${order.order_number}`} onClose={sending ? () => {} : onClose} wide>
      <BusyOverlay show={sending} label="Sending the email to the shopper…" />
      <div className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="o-ship"><h3 id="o-ship" className="font-black">Deliver to</h3><p>{order.name}<br />{order.address}<br />{order.city} {order.postal_code}<br />{order.phone}<br />{order.email}</p>{order.notes && <p className="mt-1"><span className="font-semibold">Buyer's note:</span> {order.notes}</p>}<p className="mt-1"><span className="font-semibold">Preferred courier:</span> {order.preferred_courier || <span className="text-ink-muted">not chosen yet</span>}</p></section>
          <section aria-labelledby="o-pay"><h3 id="o-pay" className="font-black">Payment to check</h3><p>Expect <strong>{peso(order.total_php)}</strong> ({peso(order.subtotal_php)} items{Number(order.shipping_php) > 0 ? ` plus ${peso(order.shipping_php)} shipping` : ""})<br />Sender: {order.sender_name}<br />Reference: <span className="font-mono">{order.reference_number}</span></p></section>
        </div>
        <ul className="divide-y divide-brand-sky rounded-lg border border-brand-sky px-3">
          {items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span className="break-words">{i.artist}: <strong>{i.title}</strong></span><span className="tabular-nums">{peso(i.unit_price_php)} × {i.quantity}</span></li>)}
        </ul>
        {fullyPaid ? (
          <div className="space-y-2 rounded-lg bg-brand-ivory p-3">
            <p>Everything is paid, so the receipts are no longer kept. Only the reference numbers are stored: <span className="font-mono">{order.reference_number}</span>{order.shipping_reference_number ? <> (shipping: <span className="font-mono">{order.shipping_reference_number}</span>)</> : null}.</p>
            {leftoverReceipts && <div className="flex flex-wrap items-center gap-2"><p className="text-ink-muted">Receipt files from before are still in storage, but they are not shown.</p><button type="button" className="btn-secondary" disabled={busy} onClick={deleteLeftover}><IconTrash />Delete receipt files</button></div>}
          </div>
        ) : order.receipt_path ? <Receipt path={order.receipt_path} /> : <p className="text-ink-muted">No receipt file is stored for this order.</p>}
        <BalanceSection key={`${order.balance_status}-${order.balance_due_php}`} order={order} onChanged={onChanged} />
        {(order.status === "pending" || order.status === "paid") && order.shipping_status && order.shipping_status !== "paid" && <CourierEditor key={order.preferred_courier || "none"} order={order} onSaved={onChanged} />}
        {order.status === "paid" && order.shipping_status && (
          <section aria-labelledby="o-shipfee" className="space-y-2 rounded-lg border border-brand-sky p-3">
            <h3 id="o-shipfee" className="flex flex-wrap items-center gap-2 font-black">Shipping fee <Badge tone={SHIPPING[order.shipping_status].tone}>{SHIPPING[order.shipping_status].label}</Badge></h3>
            {feeError && <Alert tone="bad">{feeError}</Alert>}
            {(order.shipping_status === "none" || order.shipping_status === "awaiting_payment") && (
              <>
                <p className="text-ink-muted">{order.shipping_status === "none" ? "Set what this shopper pays for shipping. They are emailed and can then pay it from their order page." : "The shopper has not paid yet. You can still change the fee."}</p>
                <InputWithAction id="ship_fee" label="Shipping fee (PHP)" hint="0 = free shipping" className="input w-40" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)}
                  action={<button type="button" className="btn-primary" disabled={busy} onClick={sendFee}><IconSend />{order.shipping_status === "none" ? "Send shipping fee" : "Update fee"}</button>} />
              </>
            )}
            {order.shipping_status === "pending_review" && (
              <>
                <p>Expect <strong>{peso(order.shipping_fee_php)}</strong> · Sender: {order.shipping_sender_name} · Reference: <span className="font-mono">{order.shipping_reference_number}</span></p>
                {order.shipping_receipt_path ? <Receipt path={order.shipping_receipt_path} label="Shipping payment receipt" /> : <p className="text-ink-muted">No receipt file is stored.</p>}
                <Field id="ship_reason" label="Reason (only needed to send it back)" hint="The shopper sees this and can pay again"><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" disabled={busy || balanceOpen} onClick={() => reviewShipping(true)}><IconCheck />Confirm shipping payment</button>
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
                  {(couriers || []).map((c) => <option key={c} value={c}>{c}</option>)}
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
          {next.map(([s, label, I]) => <button key={s} type="button" className={s === "cancelled" ? "btn-danger" : "btn-primary"} disabled={busy || (s === "shipped" && !shipOk) || (s === "paid" && balanceOpen)} onClick={() => setStatus(s)}><I />{label}</button>)}
        </div>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const load = useCallback(async (quiet = false) => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { if (!quiet) toast("Could not load the orders: " + error.message, "error"); if (quiet) return; }       // a background refresh that fails keeps what is on screen
    setOrders(data || []);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useLiveReload("orders", () => load(true));                                  // new orders and changes show up by themselves, no browser refresh
  const open = (orders || []).find((o) => o.id === openId) || null;           // the open order is always the freshest copy
  const matches = {
    set_fee: (o) => o.status === "paid" && o.shipping_status === "none",
    ship_review: (o) => o.shipping_status === "pending_review",
    underpaid: (o) => Boolean(o.balance_status) && o.balance_status !== "none",
  };
  const shown = (orders || []).filter((o) => filter === "all" || (matches[filter] ? matches[filter](o) : displayStatus(o) === filter));
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl"><IconBag />Shop orders</h1>
      <SettingsCard />
      <CourierManager />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map(([k, l]) => <button key={k} type="button" className="shop-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {orders === null ? <Loading label="Loading orders…" /> : shown.length === 0 ? <Empty>No orders here yet.</Empty> : (
        <ul className="space-y-3">
          {shown.map((o) => {
            return (
              <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><h2 className="font-black">{o.order_number} · {o.name}</h2><p className="text-sm text-ink-muted">{fmtDateTime(o.created_at)} · {peso(o.total_php)} · ref {o.reference_number}{o.preferred_courier ? ` · wants ${o.preferred_courier}` : ""}</p></div>
                <div className="flex flex-wrap items-center gap-3"><OrderStatusBadge order={o} />{o.status === "paid" && o.shipping_status && o.shipping_status !== "paid" && <Badge tone={SHIPPING[o.shipping_status].tone}>{SHIPPING[o.shipping_status].label}</Badge>}<button type="button" className="btn-secondary" onClick={() => setOpenId(o.id)}>Review{" "}<span className="sr-only">order {o.order_number}</span></button></div>
              </li>
            );
          })}
        </ul>
      )}
      {open && <OrderDialog order={open} onClose={() => setOpenId(null)} onChanged={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
