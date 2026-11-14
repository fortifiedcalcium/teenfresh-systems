import { describe, expect, it } from "vitest";
import { displayStatus, orderArgs, paymentReferences, priceOrder, validateCheckout } from "../src/lib/orders.js";

const good = { name: "Juan Dela Cruz", email: "juan@example.com", phone: "0917 123 4567", address: "12 Rizal St., Brgy. Poblacion", province: "Metro Manila (NCR)", city: "Makati City", postal_code: "1210", notes: "", sender_name: "Juan D.", reference_number: "1234 567 890" };

describe("priceOrder", () => {
  it("charges for the items only: shipping is set and paid later", () => {
    const t = priceOrder([{ price: 12.69, quantity: 2 }, { price: 75.81, quantity: 1 }], { shipping_fee_php: 150 });
    expect(t.subtotalPhp).toBe(101.19);
    expect(t.totalPhp).toBe(101.19);
  });
  it("has no floating point drift", () => {
    expect(priceOrder([{ price: 0.1, quantity: 3 }], { shipping_fee_php: 0 }).subtotalPhp).toBe(0.3);
  });
});

describe("validateCheckout", () => {
  it("accepts a complete form", () => expect(validateCheckout(good)).toEqual({}));
  it("names every missing or wrong field", () => {
    const e = validateCheckout({ ...good, name: " ", email: "nope", phone: "12345", address: "", province: "", city: "", postal_code: "12", sender_name: "", reference_number: "" });
    expect(Object.keys(e).sort()).toEqual(["address", "city", "email", "name", "phone", "postal_code", "province", "reference_number", "sender_name"]);
  });
});

describe("orderArgs", () => {
  it("sends product ids and quantities only, never a price", () => {
    const a = orderArgs(good, [{ id: "p1", qty: 2 }], "u1/x.png");
    expect(a.p_items).toEqual([{ product_id: "p1", quantity: 2 }]);
    expect(a.p_reference).toBe("1234567890");
    expect(JSON.stringify(a)).not.toMatch(/price/i);
    expect(a.p_city).toBe("Makati City, Metro Manila (NCR)");     // the city column keeps the province too
  });
});

describe("displayStatus", () => {
  const o = (x) => ({ status: "paid", shipping_status: "paid", balance_status: "none", ...x });
  it("says Paid only once everything is paid, the shipping fee included", () => {
    expect(displayStatus(o())).toBe("paid");
    expect(displayStatus(o({ shipping_status: "none" }))).toBe("pending");               // confirmed, but the shipping fee is not set or paid yet
    expect(displayStatus(o({ shipping_status: "awaiting_payment" }))).toBe("pending");
    expect(displayStatus(o({ shipping_status: "pending_review" }))).toBe("pending");
    expect(displayStatus(o({ balance_status: "awaiting_payment", balance_for: "items", status: "pending", shipping_status: "none" }))).toBe("short_items");
    expect(displayStatus(o({ balance_status: "awaiting_payment", balance_for: "shipping", shipping_status: "pending_review" }))).toBe("short_shipping");
    expect(displayStatus(o({ balance_status: "pending_review", balance_for: "shipping", shipping_status: "pending_review" }))).toBe("extra_review");
  });
  it("leaves the other statuses alone", () => {
    expect(displayStatus(o({ status: "pending", shipping_status: "none" }))).toBe("pending");
    expect(displayStatus(o({ status: "shipped" }))).toBe("shipped");
    expect(displayStatus(o({ status: "cancelled", shipping_status: "none" }))).toBe("cancelled");
    expect(displayStatus({ status: "paid" })).toBe("paid");                              // an older order has no shipping step
  });
});

describe("paymentReferences", () => {
  it("lists every reference in the order the payments happened, with what each paid for", () => {
    const o = { reference_number: "154545", shipping_reference_number: "efseeergr", balance_references: [{ for: "shipping", reference: "6767676" }, { for: "items", reference: "idfuwe" }] };
    expect(paymentReferences(o)).toEqual([
      { label: "Item Fee", reference: "154545" },
      { label: "Underpayment", reference: "idfuwe" },          // the items' extra payment comes right after the items
      { label: "Shipping Fee", reference: "efseeergr" },
      { label: "Underpayment", reference: "6767676" },         // and the shipping fee's after the shipping fee
    ]);
  });
  it("leaves out what does not exist: free shipping, no underpayment, an older order", () => {
    expect(paymentReferences({ reference_number: "111" })).toEqual([{ label: "Item Fee", reference: "111" }]);
    expect(paymentReferences({ reference_number: "111", shipping_reference_number: "222", balance_references: [] }).map((r) => r.label)).toEqual(["Item Fee", "Shipping Fee"]);
    expect(paymentReferences({})).toEqual([]);
  });
  it("lists several extra payments for the same payment", () => {
    const rows = paymentReferences({ reference_number: "1", balance_references: [{ for: "items", reference: "a" }, { for: "items", reference: "b" }] });
    expect(rows.map((r) => r.reference)).toEqual(["1", "a", "b"]);
  });
});
