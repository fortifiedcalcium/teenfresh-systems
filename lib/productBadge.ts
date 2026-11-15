import type { Tone } from "../types/ui";
import type { ProductRow, VariationRow } from "../types/shop";
import { preorderState } from "./preorder";

export interface Badge { label: string; tone: Tone }
export const LOW_STOCK_AT = 5;

type BadgeProduct = Pick<ProductRow, "pre_order" | "is_new"> & Partial<Pick<ProductRow, "stock" | "pre_order_starts_on" | "pre_order_ends_on">>;
const live = (versions: Pick<VariationRow, "active">[]) => versions.filter((v) => v.active !== false);

/** Sold out: a product with versions only when every version is at 0; a product without versions when its own stock is 0.
 *  A count that is empty (null) is never sold out. */
export function isSoldOut(p: Pick<ProductRow, never> & { stock?: number | null }, versions: Pick<VariationRow, "stock" | "active">[] = []): boolean {
  const on = live(versions) as Pick<VariationRow, "stock" | "active">[];
  return on.length > 0 ? on.every((v) => v.stock === 0) : p.stock === 0;
}

/** The single small badge a product card shows, most important first: Sold out, Low stock, Pre-order (only while its period is open), New.
 *  Stock is counted per version (or on the product when it has none); a count that is empty is never "low" and never "sold out".
 *  Nothing is invented: "Popular" is not shown because the database has no sales figure a shopper may read. */
export function badgeFor(p: BadgeProduct, versions: Pick<VariationRow, "stock" | "active">[] = [], now: Date = new Date()): Badge | null {
  if (isSoldOut(p, versions)) return { label: "Sold out", tone: "bad" };
  const on = live(versions) as Pick<VariationRow, "stock" | "active">[];
  const counts = on.length > 0 ? on.map((v) => v.stock) : [p.stock ?? null];
  if (counts.some((s) => s != null && s > 0 && s <= LOW_STOCK_AT)) return { label: "Low stock", tone: "low" };
  if (preorderState(p, now) === "open") return { label: "Pre-order", tone: "info" };
  if (p.is_new) return { label: "New", tone: "new" };
  return null;
}

const priceOf = (price: number | string, v: Pick<VariationRow, "price">) => (v.price != null ? Number(v.price) : Number(price));

/** The price a shopper sees: the lowest among the versions still in stock (all of them when nothing is in stock, next to the Sold out badge).
 *  `from` is true when the versions do not all cost the same, so the card says "From". */
export function priceFor(price: number | string, versions: Pick<VariationRow, "price" | "stock" | "active">[] = []): { amount: number; from: boolean } {
  const on = live(versions) as Pick<VariationRow, "price" | "stock" | "active">[];
  if (on.length === 0) return { amount: Number(price), from: false };
  const all = on.map((v) => priceOf(price, v));
  const inStock = on.filter((v) => v.stock == null || v.stock > 0).map((v) => priceOf(price, v));
  return { amount: Math.min(...(inStock.length ? inStock : all)), from: Math.min(...all) !== Math.max(...all) };
}

/** "From ₱x": the lowest in-stock price when a product's versions cost different amounts, else null. */
export function fromPrice(price: number | string, versions: Pick<VariationRow, "price" | "stock" | "active">[] = []): number | null {
  const r = priceFor(price, versions);
  return r.from ? r.amount : null;
}
