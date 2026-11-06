import { describe, expect, it } from "vitest";
import { step1Schema, step2Schema, makeStep3Schema, makeKitSchema, stepSchemaFor } from "../src/lib/validation.js";
import { balanceLeft, kitLabel, orderTotal, priceRange, isValidReference, priceBounds, normalizeFacebook, normalizePhone, normalizeReference, normalizeX, parseAmount, reusablePayments, validateReceiptFile, MAX_RECEIPT_BYTES } from "../src/lib/payment.js";

// the first message per field, which is what the form shows (react-hook-form keeps the first error of a field)
const issues = (schema, value) => { const r = schema.safeParse(value); return r.success ? {} : r.error.issues.reduce((o, i) => (i.path[0] in o ? o : { ...o, [i.path[0]]: i.message }), {}); };

describe("normalisers (mirror the database functions)", () => {
  it("X username: strips leading @, allows letters, numbers and underscore, max 15", () => {
    expect(normalizeX(" @@teenfresh_ph ")).toBe("teenfresh_ph");
    for (const ok of ["a", "Teen_Fresh_01", "a".repeat(15)]) expect(/^[A-Za-z0-9_]{1,15}$/.test(normalizeX(ok)), ok).toBe(true);
    for (const bad of ["", "has space", "dash-es", "a".repeat(16), "émoji", "x.y"]) expect(/^[A-Za-z0-9_]{1,15}$/.test(normalizeX(bad)), bad).toBe(false);
  });
  it("phone: 09XXXXXXXXX or +639XXXXXXXXX become +639XXXXXXXXX, anything else is refused", () => {
    expect(normalizePhone("09171234567")).toBe("+639171234567");
    expect(normalizePhone("+639171234567")).toBe("+639171234567");
    expect(normalizePhone("0917 123 4567")).toBe("+639171234567");
    expect(normalizePhone("(0917) 123-4567")).toBe("+639171234567");
    for (const bad of ["", "12345", "9171234567", "639171234567", "0817123456", "091712345678", "+63917123456", "+649171234567", "abc"]) expect(normalizePhone(bad), bad).toBeNull();
  });
  it("Facebook: facebook.com, fb.com, m.facebook.com, with or without https, normalised to https://www.facebook.com/…", () => {
    for (const v of ["fb.com/TeenfreshPH", "https://fb.com/TeenfreshPH", "http://www.facebook.com/TeenfreshPH", "m.facebook.com/TeenfreshPH", "FACEBOOK.COM/TeenfreshPH", "web.facebook.com/TeenfreshPH"]) expect(normalizeFacebook(v), v).toBe("https://www.facebook.com/TeenfreshPH");
    expect(normalizeFacebook("facebook.com/profile.php?id=100012345")).toBe("https://www.facebook.com/profile.php?id=100012345");
    for (const bad of ["", "teenfresh", "twitter.com/x", "https://evil.com/facebook.com/x", "facebook.com", "facebook.com/", "javascript:alert(1)", "fb.com/<script>", "notfacebook.com/x", "facebook.com.evil.com/x", "fb.com/has space"]) expect(normalizeFacebook(bad), bad).toBeNull();
  });
  it("reference number: entered as the banking app shows it; only spaces are removed; 1 to 64 characters", () => {
    expect(normalizeReference("1234 5678-9012 3")).toBe("12345678-90123");
    expect(normalizeReference(" AB-12 cd ")).toBe("AB-12cd");
    for (const ok of ["1234567890123", "12345678", "123", "7", "GC-2024-ab12", "0x9F3A", "REF#12/34", "a".repeat(64)]) expect(isValidReference(ok), ok).toBe(true);
    for (const bad of ["", "   ", "a".repeat(65), "ab\u0007cd"]) expect(isValidReference(bad), bad).toBe(false);
  });
  it("amount: a number with at most 2 decimals", () => {
    expect(parseAmount("100")).toBe(100); expect(parseAmount("100.50")).toBe(100.5); expect(parseAmount("₱1,000.00")).toBe(1000);
    for (const bad of ["", "abc", "10.999", "-5", "1e3", "1.2.3"]) expect(parseAmount(bad), bad).toBeNaN();
  });
});

describe("receipt files", () => {
  const file = (name, type, size = 1000) => ({ name, type, size });
  it("accepts JPG, PNG, WebP and PDF up to 10 MB", () => {
    for (const [n, t] of [["a.jpg", "image/jpeg"], ["a.JPEG", "image/jpeg"], ["a.png", "image/png"], ["a.webp", "image/webp"], ["a.pdf", "application/pdf"]]) expect(validateReceiptFile(file(n, t)), n).toBeNull();
    expect(validateReceiptFile(file("a.png", "image/png", MAX_RECEIPT_BYTES))).toBeNull();
  });
  it("refuses other types, a type/extension mismatch, empty files and files over 10 MB", () => {
    expect(validateReceiptFile(file("a.exe", "application/octet-stream"))).toMatch(/not allowed/);
    expect(validateReceiptFile(file("a.exe", "image/png"))).toMatch(/not allowed/);
    expect(validateReceiptFile(file("a.png", "application/pdf"))).toBeNull();            // extension is allowed; MIME decides storage, the bucket enforces it again
    expect(validateReceiptFile(file("a.svg", "image/svg+xml"))).toMatch(/not allowed/);
    expect(validateReceiptFile(file("a.png", "image/png", 0))).toMatch(/empty/);
    expect(validateReceiptFile(file("a.png", "image/png", MAX_RECEIPT_BYTES + 1))).toMatch(/10 MB/);
    expect(validateReceiptFile(null)).toMatch(/Attach/);
  });
});

describe("step 1: email and terms", () => {
  it("needs a valid email and the agreement", () => {
    expect(issues(step1Schema, { email: "", agree: false })).toEqual({ email: "Email is required", agree: expect.stringMatching(/agree/) });
    expect(issues(step1Schema, { email: "nope", agree: true }).email).toMatch(/valid email/);
    expect(issues(step1Schema, { email: " juan@example.com ", agree: true })).toEqual({});
  });
});

describe("step 2: participant", () => {
  const ok = { name: "Juan", x_username: "@juan_dc", facebook_url: "fb.com/juan", contact_number: "09171234567" };
  it("accepts the reference form's examples", () => { expect(issues(step2Schema, ok)).toEqual({}); });
  it("every field is required, with a specific message", () => {
    const e = issues(step2Schema, { name: "", x_username: "", facebook_url: "", contact_number: "" });
    expect(Object.keys(e).sort()).toEqual(["contact_number", "facebook_url", "name", "x_username"]);
    expect(e.x_username).toMatch(/required/);
  });
  it("rejects a bad X username, Facebook link and phone number with an explanation", () => {
    expect(issues(step2Schema, { ...ok, x_username: "has space" }).x_username).toMatch(/letters, numbers and underscores/);
    expect(issues(step2Schema, { ...ok, x_username: "@" }).x_username).toMatch(/required/);
    expect(issues(step2Schema, { ...ok, facebook_url: "twitter.com/x" }).facebook_url).toMatch(/Facebook profile link/);
    expect(issues(step2Schema, { ...ok, contact_number: "123" }).contact_number).toMatch(/09171234567/);
    expect(issues(step2Schema, { ...ok, name: "x".repeat(101) }).name).toMatch(/too long/);
  });
});

describe("step 3: payment", () => {
  const s = makeStep3Schema(100);
  const ok = { reuse_payment_id: "", sender_name: "Juan D.", amount_paid: "100", reference_number: "1234567890123", notes: "" };
  it("accepts a complete payment", () => { expect(issues(s, ok)).toEqual({}); expect(issues(s, { ...ok, amount_paid: "250.50" })).toEqual({}); });
  it("requires sender, amount and reference", () => {
    expect(Object.keys(issues(s, { ...ok, sender_name: "", amount_paid: "", reference_number: "" })).sort()).toEqual(["amount_paid", "reference_number", "sender_name"]);
  });
  it("the amount must be a number and at least the fee", () => {
    expect(issues(s, { ...ok, amount_paid: "99.99" }).amount_paid).toMatch(/at least 100.00 PHP/);
    expect(issues(s, { ...ok, amount_paid: "abc" }).amount_paid).toMatch(/number/);
    expect(issues(s, { ...ok, amount_paid: "1.234" }).amount_paid).toMatch(/2 decimals/);
  });
  it("the reference number is free text: required, at most 64 characters, any letters, digits or symbols", () => {
    expect(issues(s, { ...ok, reference_number: "" }).reference_number).toMatch(/Enter the reference number/);
    expect(issues(s, { ...ok, reference_number: "a".repeat(65) }).reference_number).toMatch(/64 characters/);
    for (const r of ["123", "12ab5678", "GC-2024-ab12", "123456789012"]) expect(issues(s, { ...ok, reference_number: r }), r).toEqual({});
  });
  it("notes are limited to 500 characters", () => {
    expect(issues(s, { ...ok, notes: "x".repeat(500) })).toEqual({});
    expect(issues(s, { ...ok, notes: "x".repeat(501) }).notes).toMatch(/500/);
  });
  it("when an earlier payment is reused, the payment fields are not required", () => {
    expect(issues(s, { reuse_payment_id: "abc", sender_name: "", amount_paid: "", reference_number: "", notes: "" })).toEqual({});
    expect(issues(s, { reuse_payment_id: "abc", sender_name: "", amount_paid: "", reference_number: "", notes: "x".repeat(501) }).notes).toMatch(/500/);
  });
  it("picks the schema for each step", () => {
    expect(stepSchemaFor("info", 100)).toBe(step1Schema);
    expect(stepSchemaFor("participant", 100)).toBe(step2Schema);
    expect(stepSchemaFor("review", 100).safeParse({}).success).toBe(true);
  });
});

const KITS = [{ id: "k1", name: "Standard kit", unit_price: 100, max_per_order: 5 }, { id: "k2", name: "Deluxe kit", unit_price: 250.5, max_per_order: 2 }];

describe("kit step: one kit per form", () => {
  const schema = makeKitSchema(KITS);
  it("accepts any kit that exists (there is no quantity to enter)", () => {
    expect(issues(schema, { kit_id: "k1" })).toEqual({});
    expect(issues(schema, { kit_id: "k2" })).toEqual({});
  });
  it("needs a kit that exists", () => {
    expect(issues(schema, { kit_id: "" }).kit_id).toMatch(/Choose a kit/);
    expect(issues(schema, { kit_id: "nope" }).kit_id).toMatch(/Choose a kit/);
  });
  it("is the schema used for the kit step, and the payment step now checks the order's total", () => {
    expect(stepSchemaFor("kit", { kits: KITS }).safeParse({ kit_id: "k1" }).success).toBe(true);
    const pay = (amount) => issues(stepSchemaFor("payment", { total: 250 }), { reuse_payment_id: "", sender_name: "Juan D.", amount_paid: amount, reference_number: "1234567890123", notes: "" });
    expect(pay("249.99").amount_paid).toMatch(/at least 250.00 PHP/);
    expect(pay("250")).toEqual({});
  });
});

describe("order total (one kit per form)", () => {
  it("is the chosen kit's price", () => {
    expect(orderTotal({ kit_id: "k1" }, KITS, 0)).toMatchObject({ qty: 1, unit: 100, total: 100 });
    expect(orderTotal({ kit_id: "k2" }, KITS, 0)).toMatchObject({ qty: 1, unit: 250.5, total: 250.5 });
  });
  it("ignores any quantity value: it is always one kit", () => {
    expect(orderTotal({ kit_id: "k1", quantity: "3" }, KITS, 0)).toMatchObject({ qty: 1, total: 100 });
  });
  it("is 0 until a kit is chosen (nothing to pay yet)", () => {
    expect(orderTotal({ kit_id: "" }, KITS, 0).total).toBe(0);
    expect(orderTotal({ kit_id: "nope" }, KITS, 0).total).toBe(0);
  });
  it("labels older multi-kit orders with their quantity and normal orders with the name only", () => {
    expect(kitLabel("Standard kit", 1)).toBe("Standard kit");
    expect(kitLabel("Standard kit", 3)).toBe("Standard kit × 3");
  });
  it("events without kits use the flat fee and a quantity of 1", () => {
    expect(orderTotal({ kit_id: "", quantity: "1" }, [], 100)).toMatchObject({ kit: null, qty: 1, unit: 100, total: 100 });
    expect(orderTotal({}, undefined, 0).total).toBe(0);
  });
  it("describes a price range for the cards", () => {
    expect(priceRange([])).toBe("");
    expect(priceRange([KITS[0]])).toBe("₱100.00");
    expect(priceRange(KITS)).toBe("₱100.00 to ₱250.50");
    // the card keeps each amount on one line and may wrap only at "to"
    expect(priceBounds([])).toBeNull();
    expect(priceBounds([KITS[0]])).toEqual({ lo: "₱100.00", hi: null });                       // one kit, or all the same price
    expect(priceBounds([KITS[0], { ...KITS[0], id: "k9" }])).toEqual({ lo: "₱100.00", hi: null });   // min equals max
    expect(priceBounds(KITS)).toEqual({ lo: "₱100.00", hi: "₱250.50" });                       // min less than max
  });
});

describe("shared payments: what is left of a payment", () => {
  const pay = (amount, forms, status = "pending") => ({ id: "p", amount_paid: amount, status, registrations: forms.map(([s, t]) => ({ status: s, total_amount: t })) });
  it("is the amount paid minus the totals of the active forms; cancelled and rejected forms use nothing", () => {
    expect(balanceLeft(pay(200, []))).toBe(200);
    expect(balanceLeft(pay(350, [["pending_verification", 100], ["confirmed", 250]]))).toBe(0);
    expect(balanceLeft(pay(300, [["pending_verification", 200]]))).toBe(100);
    expect(balanceLeft(pay(200, [["cancelled", 100], ["rejected", 100]]))).toBe(200);
    expect(balanceLeft(pay(100.1, [["confirmed", 0.1]]))).toBe(100);
  });
  it("only pending or verified payments with enough left can be reused for an order of this size", () => {
    const list = [pay(200, []), pay(100, [["confirmed", 100]]), pay(200, [], "rejected"), pay(200, [], "underpaid"), pay(300, [["pending_verification", 100]], "verified")];
    expect(reusablePayments(list, 100)).toEqual([list[0], list[4]]);
    expect(reusablePayments(list, 200)).toEqual([list[0], list[4]]);       // exactly what is left is enough
    expect(reusablePayments(list, 250)).toEqual([]);
    expect(reusablePayments(list, 0)).toEqual([]);
  });
});
