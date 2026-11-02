// Input normalisers and payment helpers. The database repeats every one of these checks (see
// 002_registration_payments.sql: normalize_* and submit_registration); the two must stay identical.

export const normalizeX = (v) => String(v ?? "").trim().replace(/^@+/, "");
export const isValidX = (v) => /^[A-Za-z0-9_]{1,15}$/.test(normalizeX(v));

/** 09XXXXXXXXX or +639XXXXXXXXX (spaces, dashes, dots and brackets ignored) -> +639XXXXXXXXX, else null */
export function normalizePhone(v) {
  const d = String(v ?? "").replace(/[\s\-().]/g, "");
  if (/^09\d{9}$/.test(d)) return "+63" + d.slice(1);
  if (/^\+639\d{9}$/.test(d)) return d;
  return null;
}

const FB_RE = /^(?:https?:\/\/)?(?:www\.|m\.|web\.|mbasic\.)?(?:facebook\.com|fb\.com)\/([A-Za-z0-9._~%+=&?/-]{1,200})$/i;
/** facebook.com, fb.com, m.facebook.com ..., with or without https:// -> https://www.facebook.com/..., else null */
export function normalizeFacebook(v) {
  const m = FB_RE.exec(String(v ?? "").trim());
  return m ? "https://www.facebook.com/" + m[1] : null;
}

export const normalizeReference = (v) => String(v ?? "").replace(/[\s-]/g, "");
export const isValidReference = (v) => /^\d{8,20}$/.test(normalizeReference(v));
/** GCash reference numbers are usually 13 digits: a different length is a warning, not an error */
export const isUnusualReferenceLength = (v) => isValidReference(v) && normalizeReference(v).length !== 13;

export const parseAmount = (v) => {
  const s = String(v ?? "").replace(/[₱,\s]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(parseFloat(s) * 100) / 100 : NaN;
};

export const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- receipt files
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

export const formatBytes = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Returns an error message, or null when the file is acceptable. Type is checked by MIME type AND extension. */
export function validateReceiptFile(file) {
  if (!file) return "Attach your payment receipt.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!RECEIPT_TYPES[file.type] || !["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) return "That file type is not allowed. Use a JPG, PNG, WebP or PDF file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_RECEIPT_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 5 MB.`;
  return null;
}

const activeForm = (r) => r.status === "pending_verification" || r.status === "confirmed";
const cents = (n) => Math.round(Number(n || 0) * 100);

/** What is left of a payment: the amount paid minus the totals of the forms already attached to it
 *  (cancelled and rejected forms do not use any of it). Same rule as submit_registration. */
export function balanceLeft(payment) {
  const used = (payment.registrations || []).filter(activeForm).reduce((a, r) => a + cents(r.total_amount), 0);
  return (cents(payment.amount_paid) - used) / 100;
}

/** Payments a new form of `total` pesos may still be attached to (pending or verified, with enough left) */
export const reusablePayments = (payments, total) => (payments || []).filter((p) => (p.status === "pending" || p.status === "verified") && total > 0 && cents(balanceLeft(p)) >= cents(total));

/** What the form orders and what it costs. With kit options the price comes from the chosen kit; without any,
 *  the event has one flat fee. Either way one form orders one kit. The database repeats this calculation and never trusts the browser. */
export function orderTotal(values, kits, fee) {
  if (kits && kits.length) {
    const kit = kits.find((k) => k.id === values.kit_id) || null;
    // one form = one kit: there is no quantity to choose
    return { kit, qty: kit ? 1 : null, unit: kit ? Number(kit.unit_price) : 0, total: kit ? cents(Number(kit.unit_price)) / 100 : 0 };
  }
  return { kit: null, qty: 1, unit: Number(fee || 0), total: Number(fee || 0) };
}

/** "₱100.00" for one price, "₱100.00 to ₱250.00" for several, "" for none */
export function priceRange(kits) {
  const prices = (kits || []).map((k) => Number(k.unit_price));
  if (!prices.length) return "";
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? peso(lo) : `${peso(lo)} to ${peso(hi)}`;
}

/** Receipt files are stored under <user id>/<random uuid>.<ext>: the original name is never used */
export const receiptPath = (userId, file) => `${userId}/${crypto.randomUUID()}.${RECEIPT_TYPES[file.type]}`;

/** "Standard kit" for a normal order; "Standard kit × 3" only for older orders placed before one form meant one kit */
export const kitLabel = (name, qty) => (Number(qty) > 1 ? `${name} × ${qty}` : name);
