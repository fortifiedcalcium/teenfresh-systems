import { supabase } from "./supabaseClient.js";

/** Reads every row of a query, 1000 at a time (Supabase caps one response at 1000 rows).
 *  `build` must return a fresh query with a deterministic order. */
export async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Calls an Edge Function and turns its JSON error into a normal Error. */
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; else if (j?.results?.[0]?.error) msg = j.results[0].error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data;
}

/** Resends confirmation emails in chunks of 50. onProgress(done, total). Returns {sent, failed}. */
export async function resendMany(ids, onProgress = () => {}) {
  let sent = 0, failed = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const { results } = await callFunction("send-confirmation-email", { registration_ids: ids.slice(i, i + 50) });
    for (const r of results) r.status === "sent" ? sent++ : failed++;
    onProgress(Math.min(i + 50, ids.length), ids.length);
  }
  return { sent, failed };
}

const ERRORS = {
  AUTH_REQUIRED: "Please sign in first.",
  TERMS_NOT_ACCEPTED: "You must accept the Terms and Conditions.",
  INVALID_NAME: "Please enter your name (2 to 100 characters).",
  INVALID_X_USERNAME: "X username can only use letters, numbers and underscores (max 15).",
  INVALID_EMAIL: "Please enter a valid email address.",
  INVALID_CONTACT: "Please enter a valid contact number.",
  EVENT_NOT_FOUND: "This event no longer exists.",
  REGISTRATION_CLOSED: "Registration for this event is closed.",
  ALREADY_REGISTERED: "That X username is already registered for this event (one form = one entry per person).",
  SOLD_OUT: "Sorry, this event is sold out.",
  FORBIDDEN: "You do not have permission to do that.",
  INVALID_FACEBOOK: "Enter a Facebook profile link, like fb.com/TeenfreshPH.",
  INVALID_NOTES: "Notes can be 500 characters at most.",
  INVALID_SENDER: "Enter the name of the GCash sender.",
  INVALID_AMOUNT: "That amount is not valid.",
  AMOUNT_TOO_LOW: "The amount is lower than what is required. Transaction fees are not covered.",
  INVALID_REFERENCE: "The reference number must be 8 to 20 digits.",
  DUPLICATE_REFERENCE: "That reference number was already used. If you paid once for several forms, choose “Use the payment details from one of my earlier forms”.",
  INVALID_RECEIPT: "The receipt upload was not accepted. Attach it again and retry.",
  INVALID_PAYMENT: "That payment can no longer be used.",
  PAYMENT_BALANCE_TOO_LOW: "That payment does not have enough left for this order. Choose a smaller order or enter a new payment.",
  INVALID_KIT: "Choose one of the available kits.",
  INVALID_QUANTITY: "That quantity is not allowed for this kit.",
  RATE_LIMIT: "You have submitted too many forms or receipts in the last hour. Please try again later.",
  ALREADY_REVIEWED: "This payment was already reviewed.",
  INSUFFICIENT_AMOUNT: "The amount paid is below the fee for the linked forms. Tick “Verify anyway” and give a reason to override.",
  OVERRIDE_REASON_REQUIRED: "Give a reason for verifying an incomplete amount.",
  AMOUNT_DUE_REQUIRED: "Enter the remaining amount due.",
  REASON_REQUIRED: "Give a reason.",
};

/** Maps the database's error codes to friendly text. */
export const friendlyError = (err) => {
  const m = String(err?.message ?? err ?? "");
  const code = Object.keys(ERRORS).find((c) => m.includes(c));
  return code ? ERRORS[code] : m || "Something went wrong. Please try again.";
};
