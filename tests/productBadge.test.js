import { describe, expect, it } from "vitest";
import { badgeFor, fromPrice } from "../lib/productBadge.ts";

describe("product badge", () => {
  it("shows Sold out only when every counted version is at zero", () => {
    expect(badgeFor({ pre_order: false, is_new: true }, [{ stock: 0 }, { stock: 0 }])?.label).toBe("Sold out");
    expect(badgeFor({ pre_order: false, is_new: true }, [{ stock: 0 }, { stock: null }])?.label).toBe("New");   // one version is not counted: still for sale
    expect(badgeFor({ pre_order: false, is_new: false }, [{ stock: 0, active: false }, { stock: 3 }])?.label).toBe("Low stock");   // a hidden version does not count
  });
  it("shows Low stock at 5 or fewer, then Pre-order, then New, in that order", () => {
    expect(badgeFor({ pre_order: true, is_new: true }, [{ stock: 5 }])?.label).toBe("Low stock");
    expect(badgeFor({ pre_order: true, is_new: true }, [{ stock: 6 }])?.label).toBe("Pre-order");
    expect(badgeFor({ pre_order: false, is_new: true })?.label).toBe("New");
    expect(badgeFor({ pre_order: false, is_new: false })).toBeNull();
  });
  it("gives a From price only when the versions differ", () => {
    expect(fromPrice(750, [{ price: null }, { price: 750 }])).toBeNull();
    expect(fromPrice(750, [{ price: null }, { price: 900 }])).toBe(750);
    expect(fromPrice(750, [{ price: 600 }, { price: 900 }])).toBe(600);
    expect(fromPrice(750)).toBeNull();
  });
});

import { isSoldOut, priceFor } from "../lib/productBadge.ts";
describe("stock on the product itself", () => {
  it("a product with no versions is sold out at 0, low at 1 to 5, and never when not counted", () => {
    expect(badgeFor({ pre_order: false, is_new: false, stock: 0 }, [])).toEqual({ label: "Sold out", tone: "bad" });
    expect(badgeFor({ pre_order: false, is_new: false, stock: 3 }, []).label).toBe("Low stock");
    expect(badgeFor({ pre_order: false, is_new: false, stock: null }, [])).toBeNull();
    expect(isSoldOut({ stock: 0 }, [])).toBe(true);
  });
  it("with versions, the product's own stock is ignored and sold out needs every version at 0", () => {
    expect(isSoldOut({ stock: 0 }, [{ stock: 0 }, { stock: 2 }])).toBe(false);
    expect(isSoldOut({ stock: 9 }, [{ stock: 0 }, { stock: 0 }])).toBe(true);
    expect(isSoldOut({ stock: 9 }, [{ stock: 0 }, { stock: null }])).toBe(false);      // not counted = always available
  });
});
describe("the price shown", () => {
  const v = (price, stock = null) => ({ price, stock, active: true });
  it("is the lowest among the versions still in stock, with From", () => {
    expect(priceFor(100, [v(35, 0), v(50, 4), v(60, 2)])).toEqual({ amount: 50, from: true });
    expect(priceFor(100, [v(35, 2), v(50, 4)])).toEqual({ amount: 35, from: true });
  });
  it("keeps From when the cheapest sells out and the rest cost the same", () => {
    expect(priceFor(100, [v(35, 0), v(50, 4), v(50, 1)])).toEqual({ amount: 50, from: true });
  });
  it("shows the lowest price of all when everything is sold out", () => {
    expect(priceFor(100, [v(35, 0), v(50, 0)])).toEqual({ amount: 35, from: true });
  });
  it("uses the product's price for a version with none, and for a product with no versions", () => {
    expect(priceFor(80, [v(null, 1), v(120, 1)])).toEqual({ amount: 80, from: true });
    expect(priceFor(80, [])).toEqual({ amount: 80, from: false });
    expect(priceFor(80, [v(null, 1), v(null, 1)])).toEqual({ amount: 80, from: false });
  });
  it("ignores versions that are switched off", () => {
    expect(priceFor(100, [{ price: 10, stock: 1, active: false }, v(50, 1)])).toEqual({ amount: 50, from: false });
  });
});
describe("Pre-order badge follows the period", () => {
  const now = new Date("2026-11-15T04:00:00Z");
  it("shows while open, not after the end or before the start", () => {
    expect(badgeFor({ pre_order: true, is_new: false, pre_order_ends_on: "2026-11-15" }, [], now).label).toBe("Pre-order");
    expect(badgeFor({ pre_order: true, is_new: false, pre_order_ends_on: "2026-11-14" }, [], now)).toBeNull();
    expect(badgeFor({ pre_order: true, is_new: true, pre_order_starts_on: "2026-11-16" }, [], now).label).toBe("New");
  });
});
