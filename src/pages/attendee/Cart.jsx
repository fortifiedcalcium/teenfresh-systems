import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { MAX_QTY, priceOrder } from "../../lib/orders.js";
import { useCart, useCartLines } from "../../lib/cart.jsx";
import { useCartProducts, useShopSettings } from "../../lib/useShop.js";
import { productImageUrl } from "../../lib/products.js";
import { peso } from "../../lib/payment.js";
import { variationLabel } from "../../lib/variations.js";
import { useAnnounce } from "../../a11y.jsx";
import Alert from "../../components/Alert.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconCart, IconImage, IconTrash } from "../../components/NavIcons.jsx";

export function LineThumb({ p }) {
  const src = productImageUrl(p);
  return src ? <img src={src} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-link object-cover" />
    : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-link bg-brand-ivory text-link" aria-hidden="true"><IconImage /></div>;
}

/** What you pay, in pesos. Shared by the cart and the checkout summary. */
export function Totals({ totals, shippingNote = true }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between gap-4"><dt>Items</dt><dd className="tabular-nums">{peso(totals.subtotalPhp)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Shipping</dt><dd className="text-right">{shippingNote ? "Set after confirmation" : "Paid separately"}</dd></div>
      <div className="flex justify-between gap-4 border-t border-brand-sky pt-2 text-base font-black"><dt>Total to pay now (GCash)</dt><dd className="tabular-nums">{peso(totals.totalPhp)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const { products, variations, error } = useCartProducts();
  const settings = useShopSettings();
  const { lines, gone } = useCartLines(products, variations);
  const announce = useAnnounce();
  useEffect(() => { gone.forEach(remove); if (gone.length) announce("A product in your cart is no longer available and was removed."); }, [gone, remove, announce]);

  const totals = priceOrder(lines);
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-3xl"><IconCart />Your cart</h1>
      {error && <Alert tone="bad">{error}</Alert>}
      {gone.length > 0 && <Alert tone="warn">A product in your cart is no longer available, so it was removed.</Alert>}
      {products === null || (items.length > 0 && !settings) ? <Loading label="Loading your cart…" className="p-12" />
        : lines.length === 0 ? <Empty>Your cart is empty. <Link to="/shop">Browse the shop</Link></Empty>
        : (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.key} className="card flex flex-wrap items-center gap-3 p-3">
                  <LineThumb p={l} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-muted">{l.artist}</p>
                    <h2 className="break-words text-base font-bold">{l.title}</h2>
                    {l.variation && <p className="text-sm font-semibold">{l.variation.options ? variationLabel(l.variation) : `Version: ${l.variation.name}`}</p>}
                    <p className="tabular-nums font-bold">{peso(l.price)}{l.discount_percent > 0 && <span className="ml-2 text-danger"><span className="sr-only">Discount </span>{l.discount_percent}%</span>}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`qty-${l.key}`} className="sr-only">Quantity of {l.title}{l.variation ? `, ${l.variation.name}` : ""}</label>
                    <select id={`qty-${l.key}`} className="input w-20" value={l.quantity} onChange={(e) => setQty(l.key, Number(e.target.value))}>
                      {Array.from({ length: MAX_QTY }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => { remove(l.key); announce(`${l.title}${l.variation ? `, ${l.variation.name},` : ""} removed from your cart`); }}><IconTrash />Remove{" "}<span className="sr-only">{l.title}{l.variation ? `, ${l.variation.name}` : ""}</span></button>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="card space-y-3 p-4" aria-label="Order summary">
              <h2 className="text-lg font-black">Summary</h2>
              <Totals totals={totals} />
              <Link to="/checkout" className="btn-primary w-full">Go to checkout</Link>
              <Link to="/shop" className="btn-secondary w-full no-underline">Keep shopping</Link>
            </aside>
          </div>
        )}
    </div>
  );
}
