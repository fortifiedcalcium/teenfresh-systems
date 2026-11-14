import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { friendlyError } from "../../lib/api.js";
import { orderArgs, priceOrder, validateCheckout } from "../../lib/orders.js";
import { useCart, useCartLines } from "../../lib/cart.jsx";
import { useCartProducts, useShopSettings } from "../../lib/useShop.js";
import { peso, receiptPath, validateReceiptFile } from "../../lib/payment.js";
import { productImageUrl } from "../../lib/products.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Alert from "../../components/Alert.jsx";
import CopyButton from "../../components/CopyButton.jsx";
import Field from "../../components/Field.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import FileUpload from "../../components/FileUpload.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { LineThumb, Totals } from "./Cart.jsx";
import { IconCart, IconSend } from "../../components/NavIcons.jsx";

const LABELS = { name: "Full name", email: "Email", phone: "Mobile number", address: "Street address", province: "Province", city: "City or municipality", postal_code: "Postal code", sender_name: "GCash sender name", reference_number: "Reference number", receipt: "Payment receipt" };

export default function Checkout() {
  const { user, profile } = useAuth();
  const { items, clear } = useCart();
  const { products, error: loadError } = useCartProducts();
  const settings = useShopSettings();
  const { lines } = useCartLines(products);
  const navigate = useNavigate();
  const [f, setF] = useState({ name: profile?.full_name || "", email: user?.email || "", phone: "", address: "", province: "", city: "", postal_code: "", notes: "", sender_name: "", reference_number: "" });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitCount, setSubmitCount] = useState(0);
  const [focusSignal, bumpFocus] = useErrorFocus();
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [places, setPlaces] = useState(null);                 // { province: [cities and municipalities] }, loaded when checkout opens
  useEffect(() => { let alive = true; import("../../data/ph-locations.json").then((m) => { if (alive) setPlaces(m.default); }); return () => { alive = false; }; }, []);
  const setProvince = (e) => setF((x) => ({ ...x, province: e.target.value, city: "" }));   // a new province starts with no city chosen

  if (products === null || !settings) return <Loading label="Loading checkout…" className="p-12" />;
  if (items.length === 0 || lines.length === 0) return <Empty>Your cart is empty. <Link to="/shop">Browse the shop</Link></Empty>;

  const totals = priceOrder(lines);
  const paymentReady = Boolean(settings.gcash_account_number);

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const errs = validateCheckout(f);
    const fileProblem = validateReceiptFile(file);
    if (fileProblem) errs.receipt = fileProblem;
    setErrors(errs); setSubmitCount((n) => n + 1);
    if (Object.keys(errs).length) { bumpFocus(); return; }
    setBusy(true);
    let path = null;
    try {
      path = receiptPath(user.id, file);
      const up = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error("We couldn't upload your receipt. Check your connection and the file, then try again.");
      const { data, error } = await supabase.rpc("place_order", orderArgs(f, items, path));
      if (error) throw error;
      clear();
      navigate(`/orders/${data.id}`, { replace: true, state: { placed: true } });
    } catch (e) {
      if (path) supabase.storage.from("payment-receipts").remove([path]);      // do not leave an unused receipt behind
      setServerError(friendlyError(e)); bumpFocus(); setBusy(false);
    }
  };

  const text = (name, label, props = {}, hint) => <Field id={name} label={label} required error={errors[name]} hint={hint}><input className="input" value={f[name]} onChange={set(name)} {...props} /></Field>;
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-3xl"><IconCart />Checkout</h1>
      {loadError && <Alert tone="bad">{loadError}</Alert>}
      {!paymentReady && <Alert tone="warn">Checkout is not open yet because the payment details are not set up. Please try again later.</Alert>}
      <ErrorSummary errors={{ ...Object.fromEntries(Object.entries(errors).map(([k, message]) => [k, { message }])) }} labels={LABELS} fieldIds={{ receipt: "receipt" }} extra={serverError} submitCount={submitCount} focusSignal={focusSignal} />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          <fieldset className="card space-y-4 p-4"><legend className="px-1 text-lg font-black">Contact and delivery</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {text("name", "Full name", { autoComplete: "name" })}
              {text("email", "Email", { type: "email", autoComplete: "email" })}
              {text("phone", "Mobile number", { type: "tel", autoComplete: "tel", inputMode: "tel" }, "For example 09171234567")}
            </div>
            {text("address", "Street address", { autoComplete: "street-address" }, "Unit/Blk No, Street, Barangay/District")}
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="province" label="Province" required error={errors.province}>
                <select className="input" autoComplete="address-level1" value={f.province} onChange={setProvince} disabled={!places}>
                  <option value="">{places ? "Choose your province…" : "Loading provinces…"}</option>
                  {places && Object.keys(places).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field id="city" label="City or municipality" required error={errors.city}>
                <select className="input" autoComplete="address-level2" value={f.city} onChange={set("city")} disabled={!places || !f.province}>
                  <option value="">{f.province ? "Choose your city or municipality…" : "Choose a province first"}</option>
                  {places && f.province && (places[f.province] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              {text("postal_code", "Postal code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 4 })}
            </div>
            <Field id="notes" label="Notes for the seller" hint="Optional"><textarea className="input" rows={2} maxLength={500} value={f.notes} onChange={set("notes")} /></Field>
          </fieldset>

          <fieldset className="card space-y-4 p-4"><legend className="px-1 text-lg font-black">Pay with GCash</legend>
            {paymentReady && (
              <div className="rounded-lg bg-brand-sky p-3 text-sm">
                <p>Send <strong>{peso(totals.totalPhp)}</strong> to:</p>
                <p className="mt-1 font-bold">{settings.gcash_account_name || "Teenfresh"}</p>
                <p className="flex flex-wrap items-center gap-2"><span className="font-mono text-base font-bold">{settings.gcash_account_number}</span><CopyButton text={settings.gcash_account_number} label="Copy GCash number" /></p>
                {settings.gcash_qr_path && (
                  <figure className="mt-3 w-48 max-w-full">
                    <img src={productImageUrl({ image_path: settings.gcash_qr_path })} alt={`GCash QR code for ${settings.gcash_account_name || "Teenfresh"}. Scan it in the GCash app to pay.`} className="w-full rounded-lg border border-link bg-white" />
                    <figcaption className="mt-1 text-sm">Or scan this QR code in the GCash app.</figcaption>
                  </figure>
                )}
                <p className="mt-2">Then enter the details below and attach your receipt. We check it within 48 to 72 hours.</p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {text("sender_name", "GCash sender name", {}, "The name on the account you paid from")}
              {text("reference_number", "Reference number", { autoComplete: "off" })}
            </div>
            <FileUpload id="receipt" file={file} onChange={setFile} error={errors.receipt} />
          </fieldset>
        </div>

        <aside className="card space-y-3 p-4 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-lg font-black">Your order</h2>
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm"><LineThumb p={l} /><span className="min-w-0 flex-1"><span className="block break-words font-bold">{l.title}</span><span className="text-ink-muted">{peso(l.price)} × {l.quantity}</span></span></li>
            ))}
          </ul>
          <Totals totals={totals} />
          <button className="btn-primary w-full" disabled={busy || !paymentReady}><IconSend />{busy ? "Placing order…" : "Place order"}</button>
          <Link to="/cart" className="btn-secondary w-full no-underline">Back to cart</Link>
        </aside>
      </form>
    </div>
  );
}
