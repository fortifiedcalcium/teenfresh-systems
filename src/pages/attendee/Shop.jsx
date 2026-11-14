import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { CHIPS, productImageUrl, productMatches } from "../../lib/products.js";
import { peso } from "../../lib/payment.js";
import { useAnnounce } from "../../a11y.jsx";
import Alert from "../../components/Alert.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { IconBag, IconImage } from "../../components/NavIcons.jsx";

function ProductCard({ p }) {
  const src = productImageUrl(p);
  return (
    <li>
      <article className="shop-card">
        <Link to={`/shop/${p.id}`} className="block" aria-label={`View ${p.title}`} tabIndex={-1}>
        <div className="shop-thumb">
          {src ? <img src={src} alt={p.image_alt || ""} loading="lazy" className="shop-art h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-link" aria-hidden="true"><IconImage /></div>}
        </div>
        </Link>
        <div className="flex flex-col gap-1 px-1 pb-2 pt-3">
          {p.pre_order && <p className="shop-pre">Pre-order</p>}
          <p className="text-sm text-ink-muted">{p.artist}</p>
          <div className="flex items-start gap-2">
            <h2 className="shop-title min-w-0 flex-1"><Link to={`/shop/${p.id}`} className="shop-card-link no-underline text-ink">{p.title}</Link></h2>
            {p.is_new && <span className="shop-new">NEW</span>}
          </div>
          <p className="flex items-baseline gap-2 text-lg font-bold tabular-nums">
            {p.discount_percent > 0 && <span className="text-danger"><span className="sr-only">Discount </span>{p.discount_percent}%</span>}
            <span className="text-ink">{peso(p.price)}</span>
          </p>
        </div>
      </article>
    </li>
  );
}

export default function Shop() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [chip, setChip] = useState("All");
  const announce = useAnnounce();

  useEffect(() => {
    let alive = true;
    supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) { setError("We could not load the products. Check your connection and refresh the page."); setProducts([]); return; }
      setProducts(data || []);
    });
    return () => { alive = false; };
  }, []);

  // "All" always shows; a category chip appears only once it has more than one product
  const chips = CHIPS.filter((c) => c === "All" || (products || []).filter((p) => productMatches(p, c)).length > 1);
  const shown = (products || []).filter((p) => productMatches(p, chip));
  const pick = (c) => {
    setChip(c);
    const n = (products || []).filter((p) => productMatches(p, c)).length;
    announce(`${c}: ${n} ${n === 1 ? "product" : "products"}`);
  };
  return (
    <section className="rounded-2xl border border-link bg-white p-4 sm:p-6" aria-labelledby="shop-title">
      <h1 id="shop-title" className="mb-4 flex items-center gap-2 text-3xl"><IconBag />Teenfresh's products <span aria-hidden="true">⭐</span></h1>
      <div className="shop-chips" role="group" aria-label="Filter products">
        {chips.map((c) => <button key={c} type="button" className="shop-chip" aria-pressed={chip === c} onClick={() => pick(c)}>{c}</button>)}
      </div>
      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}
      {products === null ? <Loading label="Loading products…" className="p-12" />
        : shown.length === 0 ? <Empty>{chip === "All" ? "No products yet. Check back soon!" : `No products in ${chip} yet.`}</Empty>
        : <ul className="shop-grid">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</ul>}
    </section>
  );
}
