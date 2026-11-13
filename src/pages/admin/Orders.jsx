import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { STATUS, sendOrderEmail } from "../../lib/orders.js";
import { usd } from "../../lib/products.js";
import { peso } from "../../lib/payment.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import Badge from "../../components/Badge.jsx";
import Field from "../../components/Field.jsx";
import Modal from "../../components/Modal.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconBag, IconCheck, IconClose, IconPackage, IconSave } from "../../components/NavIcons.jsx";

const MAIL_LABEL = { order_received: "Order received", order_paid: "Payment confirmed", order_shipped: "Shipped", order_cancelled: "Cancelled" };
const FILTERS = [["all", "All"], ["pending", "Awaiting payment check"], ["paid", "Paid"], ["shipped", "Shipped"], ["cancelled", "Cancelled"]];

/** Rate, shipping fee and GCash details. */
function SettingsCard() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("shop_settings").select("*").maybeSingle().then(({ data }) => setS({
      usd_to_php: String(data?.usd_to_php ?? 58), shipping_fee_php: String(data?.shipping_fee_php ?? 0),
      gcash_account_name: data?.gcash_account_name || "", gcash_account_number: data?.gcash_account_number || "",
    }));
  }, []);
  if (!s) return <Loading label="Loading settings…" />;
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const save = async (ev) => {
    ev.preventDefault(); setError("");
    if (!(Number(s.usd_to_php) > 0)) return setError("Enter an exchange rate above 0.");
    if (!(Number(s.shipping_fee_php) >= 0) || s.shipping_fee_php.trim() === "") return setError("Enter a shipping fee of 0 or more.");
    setSaving(true);
    const { error: err } = await supabase.from("shop_settings").update({ usd_to_php: Number(s.usd_to_php), shipping_fee_php: Number(s.shipping_fee_php), gcash_account_name: s.gcash_account_name.trim() || null, gcash_account_number: s.gcash_account_number.trim() || null, updated_at: new Date().toISOString() }).eq("id", true);
    setSaving(false);
    if (err) setError(err.message); else toast("Shop settings saved", "success");
  };
  return (
    <form onSubmit={save} className="card space-y-4 p-4" noValidate aria-labelledby="settings-h">
      <h2 id="settings-h" className="text-lg font-black">Checkout settings</h2>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="usd_to_php" label="Pesos per US dollar" required hint="Orders use this rate. Orders already placed keep the rate they were placed at."><input className="input" inputMode="decimal" value={s.usd_to_php} onChange={set("usd_to_php")} /></Field>
        <Field id="shipping_fee_php" label="Shipping fee (PHP)" hint="Added to every order. 0 = free shipping"><input className="input" inputMode="decimal" value={s.shipping_fee_php} onChange={set("shipping_fee_php")} /></Field>
        <Field id="gcash_account_name" label="GCash account name" hint="Shown to shoppers. Store it masked, for example BR**N CA**O S."><input className="input" value={s.gcash_account_name} onChange={set("gcash_account_name")} /></Field>
        <Field id="gcash_account_number" label="GCash number" hint="Checkout stays closed until this is set"><input className="input" inputMode="numeric" value={s.gcash_account_number} onChange={set("gcash_account_number")} /></Field>
      </div>
      <div className="flex justify-end"><button className="btn-primary" disabled={saving}><IconSave />{saving ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}

/** A receipt from the private bucket through a short-lived signed URL. */
function Receipt({ path }) {
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
        : <img src={url} alt="Payment receipt" className="mx-auto max-h-96 rounded-lg border border-link object-contain" />}
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
  useEffect(() => { supabase.from("order_emails").select("*").eq("order_id", order.id).order("sent_at", { ascending: false }).then(({ data }) => setMails(data || [])); }, [order.id]);
  useEffect(() => { supabase.from("order_items").select("*").eq("order_id", order.id).order("title").then(({ data }) => setItems(data || [])); }, [order.id]);
  const setStatus = async (status) => {
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status, admin_note: note.trim() || null, updated_at: new Date().toISOString() }).eq("id", order.id);
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    const mail = await sendOrderEmail(`order_${status}`, order.id);
    toast(`Order ${order.order_number}: ${STATUS[status].label}. ${mail.ok ? "The shopper was emailed." : "The email could not be sent: " + mail.error}`, mail.ok ? "success" : "error");
    onChanged();
  };
  const next = { pending: [["paid", "Mark as paid", IconCheck], ["cancelled", "Cancel order", IconClose]], paid: [["shipped", "Mark as shipped", IconPackage], ["cancelled", "Cancel order", IconClose]], shipped: [], cancelled: [] }[order.status] || [];
  return (
    <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="o-ship"><h3 id="o-ship" className="font-black">Deliver to</h3><p>{order.name}<br />{order.address}<br />{order.city} {order.postal_code}<br />{order.phone}<br />{order.email}</p>{order.notes && <p className="mt-1"><span className="font-semibold">Buyer's note:</span> {order.notes}</p>}</section>
          <section aria-labelledby="o-pay"><h3 id="o-pay" className="font-black">Payment to check</h3><p>Expect <strong>{peso(order.total_php)}</strong> ({usd(order.subtotal_usd)} at ₱{Number(order.usd_to_php)} per $1{Number(order.shipping_php) > 0 ? ` plus ${peso(order.shipping_php)} shipping` : ""})<br />Sender: {order.sender_name}<br />Reference: <span className="font-mono">{order.reference_number}</span></p></section>
        </div>
        <ul className="divide-y divide-brand-sky rounded-lg border border-brand-sky px-3">
          {items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span className="break-words">{i.artist}: <strong>{i.title}</strong></span><span className="tabular-nums">{usd(i.unit_price_usd)} × {i.quantity}</span></li>)}
        </ul>
        {order.receipt_path ? <Receipt path={order.receipt_path} /> : <p className="text-ink-muted">No receipt file is stored for this order.</p>}
        {mails.length > 0 && (
          <section aria-labelledby="o-mail"><h3 id="o-mail" className="font-black">Emails to the shopper</h3>
            <ul className="mt-1 space-y-1">{mails.map((m) => <li key={m.id} className="flex flex-wrap items-center gap-2"><Badge tone={m.status === "sent" ? "ok" : "bad"}>{m.status === "sent" ? "Sent" : "Failed"}</Badge><span>{MAIL_LABEL[m.kind]} · {fmtDateTime(m.sent_at)}{m.error ? ` · ${m.error}` : ""}</span></li>)}</ul>
          </section>
        )}
        <Field id="admin_note" label="Note (only admins see this)"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="sheet-actions flex flex-wrap justify-end gap-2 border-t border-brand-sky">
          <button type="button" className="btn-secondary" onClick={onClose}><IconClose />Close</button>
          {next.map(([s, label, I]) => <button key={s} type="button" className={s === "cancelled" ? "btn-danger" : "btn-primary"} disabled={busy} onClick={() => setStatus(s)}><I />{label}</button>)}
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
  const shown = (orders || []).filter((o) => filter === "all" || o.status === filter);
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
                <div className="flex items-center gap-3"><Badge tone={st.tone}>{st.label}</Badge><button type="button" className="btn-secondary" onClick={() => setOpen(o)}>Review{" "}<span className="sr-only">order {o.order_number}</span></button></div>
              </li>
            );
          })}
        </ul>
      )}
      {open && <OrderDialog order={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}
