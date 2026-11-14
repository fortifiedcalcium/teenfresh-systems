import { describe, expect, it } from "vitest";
import { validateVariations, validateProduct } from "../src/lib/products.js";
import { groupVariations } from "../src/lib/useShop.js";
import { lineKey } from "../src/lib/cart.jsx";
import { orderArgs } from "../src/lib/orders.js";

describe("validateVariations", () => {
  it("accepts none, or named ones with an optional price", () => {
    expect(validateVariations([])).toBe("");
    expect(validateVariations([{ name: "Version A", price: "" }, { name: "Version B", price: "850.50" }, { name: "Size M", price: 900 }])).toBe("");
  });
  it("needs a name, a price above 0 with at most 2 decimals, and no name twice", () => {
    expect(validateVariations([{ name: "  ", price: "" }])).toMatch(/needs a name/);
    expect(validateVariations([{ name: "A", price: "0" }])).toMatch(/must be above 0/);
    expect(validateVariations([{ name: "A", price: "12.345" }])).toMatch(/at most 2 decimals/);
    expect(validateVariations([{ name: "A", price: "abc" }])).toMatch(/must be above 0/);
    expect(validateVariations([{ name: "Blue", price: "" }, { name: " blue ", price: "" }])).toMatch(/used twice/);
    expect(validateVariations([{ name: "x".repeat(61), price: "" }])).toMatch(/too long/);
  });
  it("allows up to 20", () => {
    const many = (n) => Array.from({ length: n }, (_, i) => ({ name: `V${i}`, price: "" }));
    expect(validateVariations(many(20))).toBe("");
    expect(validateVariations(many(21))).toMatch(/up to 20/);
  });
  it("is part of validating a product", () => {
    const f = { artist: "A", title: "T", price: "10", discount_percent: "0", variations: [{ name: "", price: "" }] };
    expect(validateProduct(f).variations).toMatch(/needs a name/);
    expect(validateProduct({ ...f, variations: [{ name: "A", price: "" }] }).variations).toBeUndefined();
    expect(validateProduct({ ...f, variations: undefined }).variations).toBeUndefined();            // a product form from before has none
  });
});
describe("variations in the cart and the order", () => {
  it("groups versions by product, in the admin's order", () => {
    const g = groupVariations([{ id: "2", product_id: "p", name: "B", position: 1 }, { id: "1", product_id: "p", name: "A", position: 0 }, { id: "3", product_id: "q", name: "C", position: 0 }]);
    expect(g.p.map((v) => v.name)).toEqual(["A", "B"]);
    expect(g.q).toHaveLength(1);
    expect(groupVariations(null)).toEqual({});
  });
  it("the same product in two versions is two lines", () => {
    expect(lineKey({ id: "p1" })).toBe("p1");
    expect(lineKey({ id: "p1", vid: "v2" })).toBe("p1:v2");
    expect(lineKey({ id: "p1", vid: "v1" })).not.toBe(lineKey({ id: "p1", vid: "v2" }));
  });
  it("sends the chosen version to place_order, and nothing extra for a product without one", () => {
    const a = orderArgs({ name: "J", email: "j@x.io", phone: "09171234567", address: "x", city: "Makati", province: "Metro Manila (NCR)", postal_code: "1210", notes: "", sender_name: "J", reference_number: "1" },
      [{ id: "p1", vid: "v1", qty: 2 }, { id: "p2", qty: 1 }], "u/x.png");
    expect(a.p_items).toEqual([{ product_id: "p1", variation_id: "v1", quantity: 2 }, { product_id: "p2", quantity: 1 }]);
  });
});
