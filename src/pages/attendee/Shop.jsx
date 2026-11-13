import React, { useState } from "react";
import { useAnnounce } from "../../a11y.jsx";
import { Empty } from "../../components/Spinner.jsx";
import { IconBag } from "../../components/NavIcons.jsx";

// Placeholder catalogue until products come from the database. Prices are USD, already discounted.
const CHIPS = ["All", "BEST", "ALBUM", "Drama/Movie", "DVD", "PHOTOBOOK", "MD", "Pre-Order", "2027 Season's Greetings"];
const PRODUCTS = [
  { id: "blue-archive-vinyl", art: "vinyl", artist: "Various Artists", title: "BLUE ARCHIVE 5TH ANNIVERSARY : THE VINYL COLLECTION", price: 75.81, off: 20, preOrder: true, isNew: true, tags: ["MD", "BEST"] },
  { id: "jeong-saebyeok", art: "frame", artist: "Jeong Sae-byeok", title: "허무주의적 사랑", price: 12.69, off: 20, preOrder: true, isNew: true, tags: ["ALBUM"] },
  { id: "marv-orbital", art: "orbit", artist: "Marv", title: "ÖRBITAL", price: 12.78, off: 20, preOrder: false, isNew: true, tags: ["ALBUM"] },
  { id: "kassy-odyssey", art: "portrait", artist: "KASSY", title: "EP [ODYSSEY]", price: 17.04, off: 20, preOrder: true, isNew: true, tags: ["ALBUM"] },
];

const matches = (p, chip) => chip === "All" || (chip === "Pre-Order" ? p.preOrder : p.tags.includes(chip));

// Placeholder artwork, one per product. Only design-token colours (fill-/stroke- classes), so it follows the palette.
function Art({ kind, label }) {
  const common = { viewBox: "0 0 400 400", role: "img", "aria-label": label, className: "block h-full w-full shop-art" };
  if (kind === "vinyl") return (
    <svg {...common}>
      <rect width="400" height="400" className="fill-brand-sky" />
      <path d="M0 400 90 230 180 400ZM140 0 230 170 320 0ZM260 400 350 230 440 400Z" className="fill-white" opacity=".35" />
      <text x="200" y="52" textAnchor="middle" className="fill-ink" fontWeight="900" fontSize="22">5th Anniversary</text>
      <text x="200" y="84" textAnchor="middle" className="fill-ink" fontWeight="700" fontSize="18">The Vinyl Collection</text>
      <circle cx="262" cy="250" r="100" className="fill-ink" /><circle cx="262" cy="250" r="34" className="fill-brand-coral" /><circle cx="262" cy="250" r="5" className="fill-white" />
      <rect x="62" y="150" width="170" height="170" rx="4" className="fill-white stroke-ink" strokeWidth="2" transform="rotate(-6 147 235)" />
      <g transform="rotate(5 150 270)">
        <rect x="72" y="188" width="170" height="170" rx="4" className="fill-white stroke-ink" strokeWidth="2" />
        <rect x="82" y="198" width="150" height="150" className="fill-brand-blush" />
        <circle cx="157" cy="262" r="34" className="fill-brand-cream" />
        <path d="M120 262c0-30 16-46 37-46s37 16 37 46c-9-14-21-20-37-20s-28 6-37 20Z" className="fill-brand-blue" />
        <circle cx="146" cy="266" r="4" className="fill-ink" /><circle cx="169" cy="266" r="4" className="fill-ink" />
      </g>
      <text x="200" y="388" textAnchor="middle" className="fill-ink" fontWeight="700" fontSize="14">LP PACKAGE</text>
    </svg>
  );
  if (kind === "frame") return (
    <svg {...common}>
      <rect width="400" height="400" className="fill-brand-ivory" />
      <rect x="146" y="96" width="108" height="140" className="fill-white stroke-link" strokeWidth="2" />
      <rect x="158" y="108" width="84" height="100" className="fill-brand-sky" />
      <circle cx="200" cy="146" r="16" className="fill-brand-blue" /><path d="M166 208c4-26 18-38 34-38s30 12 34 38Z" className="fill-brand-blue" />
      <text x="200" y="312" textAnchor="middle" className="fill-ink" fontWeight="900" fontSize="30">허무주의적 사랑</text>
      <text x="200" y="344" textAnchor="middle" className="fill-ink-muted" fontWeight="700" fontSize="14" letterSpacing="4">JEONG SAE-BYEOK</text>
    </svg>
  );
  if (kind === "orbit") return (
    <svg {...common}>
      <rect width="400" height="400" className="fill-ink" />
      <circle cx="200" cy="190" r="112" fill="none" className="stroke-brand-ivory" strokeWidth="10" opacity=".35" />
      <circle cx="200" cy="190" r="112" fill="none" className="stroke-brand-ivory" strokeWidth="3" />
      <circle cx="200" cy="190" r="48" className="fill-brand-ivory" opacity=".5" />
      <g className="stroke-brand-ivory" strokeLinecap="round" strokeWidth="3"><path d="M200 110v160M120 190h160" /><path d="M144 134l112 112M256 134 144 246" strokeWidth="1.5" /></g>
      <text x="200" y="350" textAnchor="middle" className="fill-brand-ivory" fontWeight="900" fontSize="30" letterSpacing="8">ÖRBITAL</text>
    </svg>
  );
  return (
    <svg {...common}>
      <rect width="400" height="400" className="fill-brand-sky" />
      <path d="M96 400c6-70 46-96 104-96s98 26 104 96Z" className="fill-ink" />
      <path d="M178 300l22 40 22-40-8-34h-28Z" className="fill-brand-blush" />
      <ellipse cx="200" cy="214" rx="38" ry="48" className="fill-brand-blush" />
      <path d="M158 214c-6-60 26-88 58-78 30 10 36 50 26 90-4-30-14-52-44-54-22-2-36 14-40 42Z" className="fill-ink" />
      <text x="30" y="84" className="fill-white" fontStyle="italic" fontWeight="900" fontSize="50">Odyssey</text>
    </svg>
  );
}

function ProductCard({ p }) {
  const priceLabel = `$${p.price.toFixed(2)}`;
  return (
    <li>
      <article className="shop-card">
        <div className="shop-thumb"><Art kind={p.art} label={`Placeholder image for ${p.title}`} /></div>
        <div className="flex flex-col gap-1 px-1 pb-2 pt-3">
          {p.preOrder && <p className="shop-pre">Pre-order</p>}
          <p className="text-sm text-ink-muted">{p.artist}</p>
          <h2 className="shop-title">{p.title}</h2>
          <p className="flex items-baseline gap-2 text-lg font-bold tabular-nums">
            <span className="text-danger"><span className="sr-only">Discount </span>{p.off}%</span>
            <span className="text-ink">{priceLabel}</span>
          </p>
          {p.isNew && <span className="shop-new">NEW</span>}
        </div>
      </article>
    </li>
  );
}

export default function Shop() {
  const [chip, setChip] = useState("All");
  const announce = useAnnounce();
  const shown = PRODUCTS.filter((p) => matches(p, chip));
  const pick = (c) => {
    setChip(c);
    const n = PRODUCTS.filter((p) => matches(p, c)).length;
    announce(`${c}: ${n} ${n === 1 ? "product" : "products"}`);
  };
  return (
    <section className="rounded-2xl border border-link bg-white p-4 sm:p-6" aria-labelledby="shop-title">
      <h1 id="shop-title" className="mb-4 flex items-center gap-2 text-3xl"><IconBag />Teenfresh's products <span aria-hidden="true">⭐</span></h1>
      <div className="shop-chips" role="group" aria-label="Filter products">
        {CHIPS.map((c) => <button key={c} type="button" className="shop-chip" aria-pressed={chip === c} onClick={() => pick(c)}>{c}</button>)}
      </div>
      {shown.length === 0 ? (
        <Empty>No products in {chip} yet.</Empty>
      ) : (
        <ul className="shop-grid">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
      )}
    </section>
  );
}
