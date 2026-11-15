export const PAY_TONE = { pending: "warn", verified: "ok", underpaid: "warn", rejected: "bad" };
export const PAY_LABEL = { pending: "Pending", verified: "Verified", underpaid: "Underpaid", rejected: "Rejected" };
export const activeForms = (p) => (p.registrations || []).filter((r) => r.status === "pending_verification" || r.status === "confirmed");
/** what the forms on a payment add up to (the price of each ordered kit), in pesos */
export const expectedOf = (p) => Math.round(activeForms(p).reduce((a, r) => a + Math.round(Number(r.total_amount || 0) * 100), 0)) / 100;
