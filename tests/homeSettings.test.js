import { describe, it, expect } from "vitest";
import { bannerAlt, pickFeatured, validateBanner } from "../lib/homeSettings.ts";

const ev = (id) => ({ id });
describe("featured event", () => {
  const list = [ev("a"), ev("b"), ev("c")];
  it("uses the admin's choice, even when it is not open for registration", () => {
    expect(pickFeatured(list, "c", (e) => e.id === "b").id).toBe("c");
  });
  it("falls back to the next one that can be registered for, then to the first", () => {
    expect(pickFeatured(list, null, (e) => e.id === "b").id).toBe("b");
    expect(pickFeatured(list, "gone", () => false).id).toBe("a");
    expect(pickFeatured([], null, () => true)).toBeNull();
  });
});
describe("banner form", () => {
  it("asks for alt text unless the picture is decorative", () => {
    expect(validateBanner({ hasImage: true, decorative: false, alt: " " })).toMatch(/Describe/);
    expect(validateBanner({ hasImage: true, decorative: true, alt: "" })).toBe("");
    expect(validateBanner({ hasImage: true, decorative: false, alt: "A crowd" })).toBe("");
    expect(validateBanner({ hasImage: false, decorative: false, alt: "" })).toBe("");
    expect(validateBanner({ hasImage: true, decorative: false, alt: "x".repeat(201) })).toMatch(/longer/);
  });
  it("gives a screen reader nothing for a decorative picture", () => {
    expect(bannerAlt({ banner_alt: "A crowd", banner_decorative: true })).toBe("");
    expect(bannerAlt({ banner_alt: " A crowd ", banner_decorative: false })).toBe("A crowd");
  });
});
