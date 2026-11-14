import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { INFO_SECTIONS, productImageUrl } from "../../lib/products.js";
import { peso } from "../../lib/payment.js";
import { lineKey, useCart } from "../../lib/cart.jsx";
import { useToast } from "../../components/Toast.jsx";
import Alert from "../../components/Alert.jsx";
import FormattedText from "../../components/FormattedText.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconArrowLeft, IconCart, IconImage } from "../../components/NavIcons.jsx";
import { MAX_QTY } from "../../lib/orders.js";

const unitPrice = (p) => Number(p.price);

function Related({ items }) {
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-labelledby="related-title">
      <h2 id="related-title" className="mb-4 text-lg font-bold">Related products</h2>
      <ul className="shop-grid">
        {items.map((r) => {
          const src = productImageUrl(r);
          return (
            <li key={r.id}>
              <Link to={`/shop/${r.id}`} className="shop-card block">
                <div className="shop-thumb">
                  {src ? <img src={src} alt={r.image_alt || ""} loading="lazy" className="shop-art h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>}
                </div>
                <div className="flex flex-col gap-1 px-1 pb-2 pt-3">
                  <p className="text-sm text-ink-muted">{r.artist}</p>
                  <p className="shop-title">{r.title}</p>
                  <p className="text-lg font-bold tabular-nums">{peso(unitPrice(r))}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add, setQty } = useCart();
  const toast = useToast();
  const [product, setProduct] = useState(undefined);   // undefined = loading, null = not found
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");
  const [qty, setLocalQty] = useState(1);
  const [variations, setVariations] = useState([]);    // this product's versions, in the admin's order
  const [choice, setChoice] = useState("");             // the id of the version the shopper picked
  const [pickError, setPickError] = useState(false);
  const group = useRef(null);

  useEffect(() => {
    let alive = true;
    setProduct(undefined); setError(""); setLocalQty(1); setVariations([]); setChoice(""); setPickError(false);
    supabase.from("product_variations").select("*").eq("product_id", id).eq("active", true).order("position").then(({ data }) => {
      if (!alive) return;
      const list = data || [];
      setVariations(list);
      if (list.length === 1) setChoice(list[0].id);                          // only one version: no need to ask
    });
    supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) { setError("We could not load this product. Check your connection and refresh the page."); setProduct(null); return; }
      const all = data || [];
      const me = all.find((p) => p.id === id) || null;
      setProduct(me);
      setRelated(me ? all.filter((p) => p.id !== id && (p.artist === me.artist || (p.categories || []).some((c) => (me.categories || []).includes(c)))).slice(0, 4) : []);
    });
    return () => { alive = false; };
  }, [id]);

  if (product === undefined) return <Loading label="Loading product…" className="p-12" />;
  if (!product) {
    return (
      <section className="rounded-2xl border border-link bg-white p-4 sm:p-6">
        {error && <Alert tone="bad" className="mb-4">{error}</Alert>}
        <Empty>This product is not available.</Empty>
        <p className="mt-4 text-center"><Link to="/shop" className="btn-secondary no-underline"><IconArrowLeft />Back to the shop</Link></p>
      </section>
    );
  }

  const p = product;
  const src = productImageUrl(p);
  const chosen = variations.find((v) => v.id === choice) || null;
  const unit = chosen?.price != null ? Number(chosen.price) : unitPrice(p);
  const prices = variations.map((v) => (v.price != null ? Number(v.price) : unitPrice(p)));
  const varies = prices.length > 0 && Math.min(...prices) !== Math.max(...prices);
  const total = unit * qty;
  // a product with versions needs one picked before it can go in the cart
  const needPick = () => { if (variations.length && !choice) { setPickError(true); group.current?.querySelector("input")?.focus(); return true; } return false; };
  const addToCart = () => { add(p.id, choice || null); if (qty > 1) setQty(lineKey({ id: p.id, vid: choice || null }), qty); };   // add() puts one in; setQty tops it up to the chosen amount
  const onAdd = () => { if (needPick()) return; addToCart(); toast(`${p.title}${chosen ? ` (${chosen.name})` : ""} added to your cart`, "success"); };
  const onBuy = () => { if (needPick()) return; addToCart(); navigate("/checkout"); };

  return (
    <section className="rounded-2xl border border-link bg-white p-4 sm:p-6" aria-labelledby="product-title">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link to="/shop" className="btn-secondary no-underline"><IconArrowLeft />Shop</Link>
      </nav>
      <div className="pd-layout">
        <div className="pd-media">
          {src ? <img src={src} alt={p.image_alt || ""} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>}
        </div>

        <div className="pd-info">
          <p className="pd-artist">{p.artist}</p>
          <div className="flex items-start gap-2">
            <h1 id="product-title" className="pd-title min-w-0 flex-1">{p.title}</h1>
            {p.is_new && <span className="shop-new mt-1">NEW</span>}
          </div>

          <p className="pd-price">
            {p.discount_percent > 0 && <span className="text-danger"><span className="sr-only">Discount </span>{p.discount_percent}%</span>}
            <span>{!chosen && varies ? <><span className="text-base font-semibold">From </span>{peso(Math.min(...prices))}</> : peso(unit)}</span>
          </p>

          {p.pre_order && (
            <div className="pd-status">
              <p className="pd-status-main">Pre-order<span aria-hidden="true"> ∙ </span><span className="font-normal">This is a pre-order product.</span></p>
            </div>
          )}

          {variations.length > 0 && (
            <fieldset className="pd-variations" ref={group} aria-describedby={pickError ? "pick-err" : undefined}>
              <legend className="pd-label">Choose a version <span className="font-normal text-ink-muted">(required)</span></legend>
              <div className="flex flex-wrap gap-2">
                {variations.map((v) => (
                  <label key={v.id} className="flex min-h-target cursor-pointer items-center gap-2 rounded-lg border border-link bg-white px-3 py-2 text-sm font-semibold has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-ivory">
                    <input type="radio" name="variation" className="check" value={v.id} checked={choice === v.id} onChange={() => { setChoice(v.id); setPickError(false); }} />
                    <span>{v.name}{v.price != null && Number(v.price) !== unitPrice(p) && <span className="ml-1 font-normal text-ink-muted">{peso(v.price)}</span>}</span>
                  </label>
                ))}
              </div>
              {pickError && <p id="pick-err" role="alert" className="field-msg"><span className="error-icon error-icon--sm" aria-hidden="true">!</span>Choose a version first.</p>}
            </fieldset>
          )}
          <div className="pd-option">
            <p className="pd-label" id="opt-label">Select option</p>
            <div className="pd-option-row" role="group" aria-labelledby="opt-label">
              <span className="pd-option-name">{p.title}{chosen ? ` · ${chosen.name}` : ""}</span>
              <div className="pd-qty">
                <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setLocalQty((q) => Math.max(1, q - 1))}>−</button>
                <output aria-live="polite" aria-label="Quantity">{qty}</output>
                <button type="button" aria-label="Increase quantity" disabled={qty >= MAX_QTY} onClick={() => setLocalQty((q) => Math.min(MAX_QTY, q + 1))}>+</button>
              </div>
            </div>
          </div>

          <p className="pd-total"><span>Total</span><strong className="tabular-nums">{peso(total)}</strong></p>

          <div className="pd-actions">
            <button type="button" className="btn-secondary" onClick={onAdd}><IconCart />Add to cart</button>
            <button type="button" className="btn-primary" onClick={onBuy}>Buy now</button>
          </div>
        </div>
      </div>
      {(INFO_SECTIONS.some(([k]) => p[k]) || (p.info_images || []).length > 0) && (
        <div className="pd-accordion">
          {INFO_SECTIONS.filter(([k]) => p[k] || (k === "info_description" && (p.info_images || []).length > 0)).map(([k, label], i) => (
            <details key={k} open={i === 0}>
              <summary>{label}</summary>
              <div className="pd-prose">
                {k === "info_description" && (p.info_images || []).map((path, n) => <img key={path} src={productImageUrl({ image_path: path })} alt={`${p.title}, detail ${n + 1}`} loading="lazy" className="pd-desc-img" />)}
                <FormattedText text={p[k]} />
              </div>
            </details>
          ))}
        </div>
      )}
      <Related items={related} />
    </section>
  );
}
