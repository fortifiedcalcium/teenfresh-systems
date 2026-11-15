import type { Tone } from "../types/ui";
import type { ProductRow, VariationRow } from "../types/shop";

export interface Badge { label: string; tone: Tone }
export const LOW_STOCK_AT = 5;

/** The single small badge a product card shows, most important first: Sold out, Low stock, Pre-order, New.
 *  Stock is counted per version; a version with no count (null) is never "low" and never "sold out". Nothing is invented: "Popular" is not shown
 *  because the database has no sales figure a shopper may read. */
export function badgeFor(p: Pick<ProductRow, "pre_order" | "is_new">, versions: Pick<VariationRow, "stock" | "active">[] = []): Badge | null {
  const on = versions.filter((v) => v.active !== false);
  if (on.length > 0 && on.every((v) => v.stock === 0)) return { label: "Sold out", tone: "bad" };
  if (on.some((v) => v.stock != null && v.stock > 0 && v.stock <= LOW_STOCK_AT)) return { label: "Low stock", tone: "low" };
  if (p.pre_order) return { label: "Pre-order", tone: "info" };
  if (p.is_new) return { label: "New", tone: "new" };
  return null;
}

/** "From ₱x" when a product's versions cost different amounts: the lowest price, else null. */
export function fromPrice(price: number | string, versions: Pick<VariationRow, "price">[] = []): number | null {
  const prices = versions.map((v) => (v.price != null ? Number(v.price) : Number(price)));
  return prices.length > 0 && Math.min(...prices) !== Math.max(...prices) ? Math.min(...prices) : null;
}
