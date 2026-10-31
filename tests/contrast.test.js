import { describe, expect, it } from "vitest";
import { APPROVED, BRAND, FORBIDDEN, checkTokens, ratio, readTokens, scanSource } from "../scripts/contrast.js";

describe("colour tokens (WCAG 2.2)", () => {
  const { failures, results } = checkTokens();

  it("tokens.css matches the Teenfresh brand guide exactly", () => {
    const t = readTokens();
    for (const [k, v] of Object.entries(BRAND)) expect(t[k], k).toBe(v);
  });
  it("every approved pairing meets its required ratio", () => {
    expect(failures).toEqual([]);
    expect(results.filter((r) => !r.forbidden).length).toBe(APPROVED.length);
  });
  it("matches the ratios published in the brand add-on", () => {
    const t = readTokens();
    const expected = [["ink", "white", 13.7], ["ink", "brand-cream", 11.2], ["ink", "brand-coral", 6.1], ["ink", "brand-blue", 5.2], ["ink-muted", "white", 9.1], ["link", "white", 7.4], ["link", "brand-sky", 5.0], ["danger", "white", 9.1], ["success", "brand-mint", 6.5], ["warning-ink", "brand-cream", 11.0]];
    for (const [f, b, r] of expected) expect(ratio(t[f], t[b]), `${f}/${b}`).toBeCloseTo(r, 0);
  });
  it("brand colours really are inaccessible as text on light surfaces (why they are surfaces only)", () => {
    const t = readTokens();
    expect(ratio(t["brand-blue"], t.white)).toBeLessThan(3);
    expect(ratio(t["brand-coral"], t.white)).toBeLessThan(3);
    expect(ratio(t["brand-blue"], t["brand-cream"])).toBeLessThan(3);
    for (const [f, b] of FORBIDDEN) expect(ratio(t[f], t[b]), `${f}/${b}`).toBeLessThan(4.5);
  });
  it("the source uses no forbidden pairing, no brand colour as text, and no hard-coded hex", () => {
    expect(scanSource().failures).toEqual([]);
  });
});
