import { describe, it, expect } from "vitest";
import { manilaToday, preorderBuyable, preorderNotice, preorderState, validatePreorderDates } from "../lib/preorder.ts";
import { productRow, validateProduct } from "../lib/products.ts";
import { blankProduct, productToForm } from "../lib/productForm.ts";

const P = (o = {}) => ({ pre_order: true, pre_order_starts_on: null, pre_order_ends_on: null, ...o });
// 16:30 UTC on 14 Nov is 00:30 on 15 Nov in Manila (UTC+8): the Manila day is already the 15th
const at = (iso) => new Date(iso);

describe("pre-order period (Asia/Manila)", () => {
  it("counts the day in Manila time, not UTC", () => {
    expect(manilaToday(at("2026-11-14T16:30:00Z"))).toBe("2026-11-15");
    expect(manilaToday(at("2026-11-14T15:59:00Z"))).toBe("2026-11-14");
  });
  it("is open from the start date to the end date, both included", () => {
    const p = P({ pre_order_starts_on: "2026-11-10", pre_order_ends_on: "2026-11-15" });
    expect(preorderState(p, at("2026-11-09T15:59:00Z"))).toBe("upcoming");   // still the 9th in Manila
    expect(preorderState(p, at("2026-11-09T16:00:00Z"))).toBe("open");       // midnight on the 10th in Manila
    expect(preorderState(p, at("2026-11-15T15:59:00Z"))).toBe("open");       // the last evening of the last day
    expect(preorderState(p, at("2026-11-15T16:00:00Z"))).toBe("ended");      // midnight on the 16th in Manila
  });
  it("no dates means no limit, and a normal product is not a pre-order", () => {
    expect(preorderState(P(), at("2030-01-01T00:00:00Z"))).toBe("open");
    expect(preorderState(P({ pre_order: false, pre_order_ends_on: "2020-01-01" }))).toBe("none");
  });
  it("says why it cannot be bought, and only then", () => {
    const ended = P({ pre_order_ends_on: "2020-01-01" }), soon = P({ pre_order_starts_on: "2099-12-03" });
    expect(preorderNotice(ended)).toBe("Pre-order period ended");
    expect(preorderNotice(soon)).toBe("Pre-order opens Dec 3");
    expect(preorderNotice(P())).toBe("");
    expect(preorderNotice(P({ pre_order: false }))).toBe("");
    expect(preorderBuyable(ended)).toBe(false);
    expect(preorderBuyable(soon)).toBe(false);
    expect(preorderBuyable(P())).toBe(true);
    expect(preorderBuyable(P({ pre_order: false }))).toBe(true);
  });
  it("checks the two dates a form holds", () => {
    expect(validatePreorderDates("", "")).toBe("");
    expect(validatePreorderDates("2026-11-10", "2026-11-10")).toBe("");
    expect(validatePreorderDates("2026-11-10", "2026-11-09")).toMatch(/before/);
    expect(validatePreorderDates("10/11/2026", "")).toMatch(/day, month and year/);
  });
});

describe("product form: stock and dates", () => {
  const form = (o = {}) => ({ ...blankProduct(), artist: "A", title: "T", price: "100", ...o });
  it("saves a product's own stock when it has no variations, empty meaning not counted", () => {
    expect(productRow(form({ stock: "7" })).stock).toBe(7);
    expect(productRow(form({ stock: "0" })).stock).toBe(0);
    expect(productRow(form({ stock: "" })).stock).toBeNull();
  });
  it("leaves the product's stock empty when it has variations (they count their own)", () => {
    expect(productRow(form({ stock: "7", variations: [{ key: "a", name: "One", price: "", stock: "3" }] })).stock).toBeNull();
  });
  it("rejects a stock that is not a whole number", () => {
    expect(validateProduct(form({ stock: "-1" })).stock).toBeTruthy();
    expect(validateProduct(form({ stock: "2.5" })).stock).toBeTruthy();
    expect(validateProduct(form({ stock: "5" })).stock).toBeUndefined();
  });
  it("keeps the pre-order dates only for a pre-order, and rejects an end before the start", () => {
    expect(productRow(form({ pre_order: true, pre_order_starts_on: "2026-12-01", pre_order_ends_on: "2026-12-31" }))).toMatchObject({ pre_order_starts_on: "2026-12-01", pre_order_ends_on: "2026-12-31" });
    expect(productRow(form({ pre_order: false, pre_order_ends_on: "2026-12-31" })).pre_order_ends_on).toBeNull();
    expect(validateProduct(form({ pre_order: true, pre_order_starts_on: "2026-12-31", pre_order_ends_on: "2026-12-01" })).pre_order_dates).toBeTruthy();
    expect(validateProduct(form({ pre_order: false, pre_order_starts_on: "2026-12-31", pre_order_ends_on: "2026-12-01" })).pre_order_dates).toBeUndefined();
  });
  it("loads a saved product into the form", () => {
    const f = productToForm({ id: "1", artist: "A", title: "T", price: 100, stock: 4, pre_order: true, pre_order_starts_on: "2026-12-01", pre_order_ends_on: null, categories: [] });
    expect(f).toMatchObject({ stock: "4", pre_order_starts_on: "2026-12-01", pre_order_ends_on: "" });
  });
});
