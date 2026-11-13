import { describe, expect, it } from "vitest";
import { orderArgs, priceOrder, validateCheckout } from "../src/lib/orders.js";

const good = { name: "Juan Dela Cruz", email: "juan@example.com", phone: "0917 123 4567", address: "12 Rizal St., Brgy. Poblacion", city: "Makati", postal_code: "1210", notes: "", sender_name: "Juan D.", reference_number: "1234 567 890" };

describe("priceOrder", () => {
  it("converts the dollar total at the rate and adds shipping in pesos", () => {
    const t = priceOrder([{ price: 12.69, quantity: 2 }, { price: 75.81, quantity: 1 }], { usd_to_php: 58, shipping_fee_php: 150 });
    expect(t.subtotalUsd).toBe(101.19);
    expect(t.subtotalPhp).toBe(5869.02);
    expect(t.totalPhp).toBe(6019.02);
  });
  it("has no floating point drift", () => {
    expect(priceOrder([{ price: 0.1, quantity: 3 }], { usd_to_php: 1, shipping_fee_php: 0 }).subtotalUsd).toBe(0.3);
  });
});

describe("validateCheckout", () => {
  it("accepts a complete form", () => expect(validateCheckout(good)).toEqual({}));
  it("names every missing or wrong field", () => {
    const e = validateCheckout({ ...good, name: " ", email: "nope", phone: "12345", address: "", city: "", postal_code: "12", sender_name: "", reference_number: "" });
    expect(Object.keys(e).sort()).toEqual(["address", "city", "email", "name", "phone", "postal_code", "reference_number", "sender_name"]);
  });
});

describe("orderArgs", () => {
  it("sends product ids and quantities only, never a price", () => {
    const a = orderArgs(good, [{ id: "p1", qty: 2 }], "u1/x.png");
    expect(a.p_items).toEqual([{ product_id: "p1", quantity: 2 }]);
    expect(a.p_reference).toBe("1234567890");
    expect(JSON.stringify(a)).not.toMatch(/price/i);
  });
});
