// Pre-order period. The dates are whole days in Philippine time (Asia/Manila); the end date is the last day the product can be ordered.
// The database checks the same thing in place_order(), so the shop only mirrors it to show the right label and switch Add to cart off.

export type PreorderState = "none" | "open" | "upcoming" | "ended";
interface PreorderFields { pre_order?: boolean; pre_order_starts_on?: string | null; pre_order_ends_on?: string | null }

/** Today's date in Manila as YYYY-MM-DD. */
export const manilaToday = (now: Date = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** none: not a pre-order. open: inside its period (or it has no dates). upcoming: before the start date. ended: after the end date. */
export function preorderState(p: PreorderFields, now: Date = new Date()): PreorderState {
  if (!p.pre_order) return "none";
  const today = manilaToday(now);
  if (p.pre_order_starts_on && today < p.pre_order_starts_on) return "upcoming";
  if (p.pre_order_ends_on && today > p.pre_order_ends_on) return "ended";
  return "open";
}

const day = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** The label for the product's thumbnail: shown only when the pre-order cannot be bought right now. */
export function preorderNotice(p: PreorderFields, now: Date = new Date()): string {
  const s = preorderState(p, now);
  if (s === "ended") return "Pre-order period ended";
  if (s === "upcoming") return p.pre_order_starts_on ? `Pre-order opens ${day(p.pre_order_starts_on)}` : "Pre-order not open yet";
  return "";
}

/** Can it be added to the cart as far as the pre-order period goes? */
export const preorderBuyable = (p: PreorderFields, now: Date = new Date()): boolean => { const s = preorderState(p, now); return s === "none" || s === "open"; };

/** A problem with the two dates the admin typed (YYYY-MM-DD, or empty), in plain words, or "". */
export function validatePreorderDates(start: string, end: string): string {
  const ok = (v: string) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!ok(start) || !ok(end)) return "Enter the pre-order dates as day, month and year.";
  if (start && end && end < start) return "The pre-order end date is before its start date.";
  return "";
}
