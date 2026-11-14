import { describe, expect, it } from "vitest";
import { validateVariations, validateProduct } from "../src/lib/products.js";
import { groupVariations } from "../src/lib/useShop.js";
import { lineKey } from "../src/lib/cart.jsx";
import { orderArgs } from "../src/lib/orders.js";
import { buildCombos, comboKeyOf, finalVariations, normalizeLayers, parseValues, validateLayers, variationLabel } from "../src/lib/variations.js";
import { productRow } from "../src/lib/products.js";

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

describe("layers of variations (like buying a phone)", () => {
  const phone = [{ name: "Color", values: "Black, White" }, { name: "Storage", values: "128GB, 256GB, 512GB" }];
  it("reads values from text: trimmed, no blanks, no repeats in any capitals", () => {
    expect(parseValues(" Black, white ,BLACK,, \n Gold ")).toEqual(["Black", "white", "Gold"]);
    expect(parseValues("")).toEqual([]);
    expect(parseValues(null)).toEqual([]);
  });
  it("drops empty layer rows and keeps the others in order", () => {
    expect(normalizeLayers([{ name: " Color ", values: "Black, White" }, { name: "", values: "" }, { name: "Storage", values: ["128GB"] }]))
      .toEqual([{ name: "Color", values: ["Black", "White"] }, { name: "Storage", values: ["128GB"] }]);
  });
  it("builds every combination, in order, with a readable name and the choice kept apart", () => {
    const combos = buildCombos(normalizeLayers(phone));
    expect(combos).toHaveLength(6);
    expect(combos.map((c) => c.name)).toEqual(["Black / 128GB", "Black / 256GB", "Black / 512GB", "White / 128GB", "White / 256GB", "White / 512GB"]);
    expect(combos[1].options).toEqual({ Color: "Black", Storage: "256GB" });
    expect(new Set(combos.map((c) => c.key)).size).toBe(6);
    expect(buildCombos([])).toEqual([]);
    expect(buildCombos(normalizeLayers([{ name: "Size", values: "S, M" }])).map((c) => c.name)).toEqual(["S", "M"]);         // one layer works too
  });
  it("finds a saved combination again by its choice, even if the layers are listed in a different order in the data", () => {
    const layers = normalizeLayers(phone);
    expect(comboKeyOf({ Storage: "256GB", Color: "Black" }, layers)).toBe(buildCombos(layers)[1].key);
    expect(comboKeyOf({ Color: "Black" }, layers)).toBeNull();                      // a layer is missing
    expect(comboKeyOf(null, layers)).toBeNull();
  });
  it("checks the layers in plain words", () => {
    const ok = normalizeLayers(phone);
    expect(validateLayers(ok)).toBe("");
    expect(validateLayers(normalizeLayers([...phone, { name: "Condition", values: "New, Used" }, { name: "Region", values: "PH, US" }]))).toMatch(/up to 3 layers/);
    expect(validateLayers([{ name: "", values: ["A"] }])).toMatch(/Give every layer a name/);
    expect(validateLayers([{ name: "Color", values: [] }])).toMatch(/Add at least one value to "Color"/);
    expect(validateLayers([{ name: "Color", values: ["A"] }, { name: "color", values: ["B"] }])).toMatch(/Two layers are called/);
    expect(validateLayers([{ name: "Color", values: Array.from({ length: 11 }, (_, i) => `c${i}`) }])).toMatch(/up to 10 values/);
    expect(validateLayers([{ name: "Color", values: ["x".repeat(31)] }])).toMatch(/too long/);
    const big = Array.from({ length: 10 }, (_, i) => `v${i}`);
    expect(validateLayers([{ name: "A", values: big }, { name: "B", values: big }])).toMatch(/100 combinations; the most is 60/);
    expect(validateLayers([{ name: "A", values: ["x".repeat(30)] }, { name: "B", values: ["y".repeat(30)] }])).toMatch(/longer than 60/);
  });
  it("saves the combinations with their prices and whether they are for sale, or the simple list when there are no layers", () => {
    const f = { layers: phone, combos: { [buildCombos(normalizeLayers(phone))[1].key]: { id: "v1", price: "35000", active: false } }, variations: [{ name: "ignored", price: "1" }] };
    const list = finalVariations(f);
    expect(list).toHaveLength(6);
    expect(list[1]).toEqual({ id: "v1", name: "Black / 256GB", price: "35000", active: false, options: { Color: "Black", Storage: "256GB" } });
    expect(list[0]).toMatchObject({ id: null, price: "", active: true });                       // new ones default to the product's price and for sale
    expect(finalVariations({ layers: [], variations: [{ id: "x", name: "Version A", price: "" }] })).toEqual([{ id: "x", name: "Version A", price: "", active: true, options: null }]);
  });
  it("is part of the product row, and checked with the product", () => {
    expect(productRow({ artist: "A", title: "T", price: "1", discount_percent: "0", categories: [], image_alt: "", layers: phone }).variation_layers)
      .toEqual([{ name: "Color", values: ["Black", "White"] }, { name: "Storage", values: ["128GB", "256GB", "512GB"] }]);
    expect(productRow({ artist: "A", title: "T", price: "1", discount_percent: "0", categories: [], image_alt: "" }).variation_layers).toEqual([]);
    const f = { artist: "A", title: "T", price: "10", discount_percent: "0" };
    expect(validateProduct({ ...f, layers: [{ name: "Color", values: "" }] }).variations).toMatch(/Add at least one value/);
    expect(validateProduct({ ...f, layers: phone, combos: {} }).variations).toBeUndefined();
    expect(validateProduct({ ...f, layers: phone, combos: { [buildCombos(normalizeLayers(phone))[0].key]: { price: "-5" } } }).variations).toMatch(/must be above 0/);
  });
  it("reads a chosen combination to a shopper", () => {
    expect(variationLabel({ name: "Black / 128GB", options: { Color: "Black", Storage: "128GB" } })).toBe("Color: Black · Storage: 128GB");
    expect(variationLabel({ name: "Version A", options: null })).toBe("Version A");
    expect(variationLabel(null)).toBe("");
  });
});
