import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { CATEGORIES, productImageUrl, productRow, removeProductImage, uploadProductImage, usd, validateProduct } from "../../lib/products.js";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, validateImageFile } from "../../lib/eventImages.js";
import { useToast } from "../../components/Toast.jsx";
import { useAnnounce } from "../../a11y.jsx";
import Modal from "../../components/Modal.jsx";
import Field from "../../components/Field.jsx";
import Alert from "../../components/Alert.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ErrorSummary, { useErrorFocus } from "../../components/ErrorSummary.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconBag, IconClose, IconImage, IconPencil, IconPlus, IconSave, IconTrash, IconUpload } from "../../components/NavIcons.jsx";

const blank = () => ({ id: null, artist: "", title: "", price: "", discount_percent: "0", pre_order: false, is_new: true, categories: [], image_path: null, image_alt: "", active: true });
const toForm = (p) => ({ ...blank(), ...p, price: String(p.price), discount_percent: String(p.discount_percent ?? 0), image_alt: p.image_alt || "", categories: p.categories || [] });
const ACCEPT = Object.keys(IMAGE_TYPES).join(",");

function Thumb({ p, className = "" }) {
  const src = productImageUrl(p);
  return src
    ? <img src={src} alt="" className={`object-cover ${className}`} />
    : <div className={`flex items-center justify-center bg-brand-ivory text-link ${className}`} aria-hidden="true"><IconImage /></div>;
}

/** Admin: add, edit, hide and delete the products on the public Shop page. */
export default function Products() {
  const toast = useToast();
  const announce = useAnnounce();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);       // null = closed; object = new (no id) or editing
  const [file, setFile] = useState(null);       // a newly chosen image, not uploaded until Save
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitCount, setSubmitCount] = useState(0);
  const [focusSignal, bumpFocus] = useErrorFocus();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) { toast("Could not load the products: " + error.message, "error"); setRows([]); return; }
    setRows(data || []);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const open = (p) => { setForm(p ? toForm(p) : blank()); setFile(null); setFileError(""); setErrors({}); setFormError(""); };
  const close = () => setForm(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleCategory = (c) => setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  const take = (f) => {
    const bad = validateImageFile(f);
    if (bad) { setFileError(bad); announce(bad, "assertive"); return; }
    setFileError(""); setFile(f); announce(`Selected ${f.name}`);
  };

  const save = async (ev) => {
    ev.preventDefault();
    setSubmitCount((n) => n + 1); setFormError("");
    const errs = validateProduct(form);
    setErrors(errs);
    if (Object.keys(errs).length) { bumpFocus(); return; }
    setSaving(true);
    let newPath = null;
    try {
      const row = productRow(form);
      if (file) { newPath = await uploadProductImage(file); row.image_path = newPath; }
      const { error } = form.id ? await supabase.from("products").update(row).eq("id", form.id) : await supabase.from("products").insert(row);
      if (error) throw new Error(error.message);
      if (newPath && form.image_path) await removeProductImage(form.image_path);   // tidy up the replaced file
      toast(form.id ? "Product saved" : "Product added", "success");
      setForm(null);
      await load();
    } catch (e) {
      if (newPath) await removeProductImage(newPath);                              // do not leave an orphaned upload behind
      setFormError(e.message || "Could not save the product");
    } finally { setSaving(false); }
  };

  const toggleActive = async (p) => {
    const { error } = await supabase.from("products").update({ active: !p.active, updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) toast(error.message, "error"); else { toast(p.active ? "Hidden from the shop" : "Visible in the shop", "success"); load(); }
  };
  const remove = async () => {
    const { error } = await supabase.from("products").delete().eq("id", deleting.id);
    if (error) toast(error.message, "error");
    else { await removeProductImage(deleting.image_path); toast("Product deleted", "success"); load(); }
    setDeleting(null);
  };

  const shownImage = preview || (form?.image_path ? productImageUrl(form) : null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl"><IconBag />Shop products</h1>
        <button type="button" className="btn-primary" onClick={() => open(null)}><IconPlus />Add a product</button>
      </div>
      <p className="text-sm text-ink-muted">These appear on the public Shop page. Prices are in US dollars. A hidden product stays here but is not shown to visitors.</p>

      {rows === null ? <Loading label="Loading products…" /> : rows.length === 0 ? <Empty>No products yet. Add the first one.</Empty> : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3">
              <Thumb p={p} className="h-16 w-16 shrink-0 rounded-lg border border-link" />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-base font-black">{p.title}</h2>
                <p className="text-sm text-ink-muted">{p.artist} · {usd(p.price)}{p.discount_percent > 0 ? ` · ${p.discount_percent}% off` : ""}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  <span className={`badge ${p.active ? "badge-ok" : "badge-neutral"}`}>{p.active ? "Visible" : "Hidden"}</span>
                  {p.pre_order && <span className="badge badge-info">Pre-order</span>}
                  {p.is_new && <span className="badge badge-info">New</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => toggleActive(p)}>{p.active ? "Hide" : "Show"}<span className="sr-only"> {p.title}</span></button>
                <button type="button" className="btn-secondary" onClick={() => open(p)}><IconPencil />Edit{" "}<span className="sr-only">{p.title}</span></button>
                <button type="button" className="btn-danger" onClick={() => setDeleting(p)}><IconTrash />Delete{" "}<span className="sr-only">{p.title}</span></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <Modal title={form.id ? "Edit product" : "Add a product"} onClose={close} wide>
          <form onSubmit={save} className="space-y-5" noValidate>
            {formError && <Alert tone="bad">{formError}</Alert>}
            <ErrorSummary errors={Object.fromEntries(Object.entries(errors).map(([k, message]) => [`p-${k}`, { message }]))} submitCount={submitCount} focusSignal={focusSignal} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="p-artist" label="Artist" required error={errors.artist}><input className="input" maxLength={80} value={form.artist} onChange={set("artist")} /></Field>
              <Field id="p-title" label="Product title" required error={errors.title}><input className="input" maxLength={160} value={form.title} onChange={set("title")} /></Field>
              <Field id="p-price" label="Price (USD)" required error={errors.price} hint="The price shown to visitors, for example 12.69"><input className="input" inputMode="decimal" value={form.price} onChange={set("price")} /></Field>
              <Field id="p-discount_percent" label="Discount (%)" error={errors.discount_percent} hint="Shown in red next to the price. 0 hides it"><input className="input" inputMode="numeric" value={form.discount_percent} onChange={set("discount_percent")} /></Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="label">Categories <span className="font-normal text-ink-muted">(the shop filters)</span></legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex min-h-target items-center gap-2 text-sm"><input type="checkbox" className="check" checked={form.categories.includes(c)} onChange={() => toggleCategory(c)} />{c}</label>
                ))}
              </div>
              <p className="hint">The Pre-Order filter uses the Pre-order switch below.</p>
            </fieldset>

            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={form.pre_order} onChange={set("pre_order")} />Pre-order</label>
              <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={form.is_new} onChange={set("is_new")} />Show the NEW badge</label>
              <label className="flex min-h-target items-center gap-3 text-sm"><input type="checkbox" className="check" checked={form.active} onChange={set("active")} />Visible in the shop</label>
            </div>

            <fieldset className="space-y-3">
              <legend className="label">Image</legend>
              <div className="flex flex-wrap items-start gap-4">
                <div className="aspect-square w-40 overflow-hidden rounded-2xl border border-link bg-brand-ivory">
                  {shownImage ? <img src={shownImage} alt="Preview of the product" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input ref={inputRef} id="p-image" type="file" accept={ACCEPT} className="file-input sr-only" aria-describedby="p-image-hint" onChange={(e) => { if (e.target.files?.[0]) take(e.target.files[0]); e.target.value = ""; }} />
                  <label htmlFor="p-image" className="btn-secondary cursor-pointer"><IconUpload />{shownImage ? "Replace image" : "Choose image"}</label>
                  {file && <button type="button" className="btn-secondary ml-2" onClick={() => { setFile(null); setFileError(""); }}><IconClose />Undo choice</button>}
                  <p id="p-image-hint" className="hint">Square works best. JPG, PNG or WebP, up to {MAX_IMAGE_BYTES / 1024 / 1024} MB.{file ? ` Chosen: ${file.name}. It uploads when you save.` : ""}</p>
                  {fileError && <p role="alert" className="flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{fileError}</p>}
                  <Field id="p-image_alt" label="Image description" hint="Read aloud by screen readers, for example: Blue album cover with a glowing ring"><input className="input" value={form.image_alt} onChange={set("image_alt")} /></Field>
                </div>
              </div>
            </fieldset>

            <div className="sheet-actions flex justify-end gap-2 border-t border-brand-sky">
              <button type="button" className="btn-secondary" onClick={close}><IconClose />Cancel</button>
              <button className="btn-primary" disabled={saving}><IconSave />{saving ? "Saving…" : form.id ? "Save product" : "Add product"}</button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && <ConfirmDialog title="Delete this product?" confirmLabel="Delete product" onCancel={() => setDeleting(null)} onConfirm={remove}>Delete <strong>{deleting.title}</strong> and its image? This cannot be undone. To keep it but hide it from visitors, use Hide instead.</ConfirmDialog>}
    </div>
  );
}
