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
