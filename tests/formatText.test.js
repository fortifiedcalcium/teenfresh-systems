import { describe, expect, it } from "vitest";
import { wrapSelection } from "../src/lib/formatText.js";

const B = ["<strong>", "</strong>"];
describe("wrapSelection", () => {
  it("wraps the selected text and keeps it selected", () => {
    const r = wrapSelection("Hello world", 6, 11, ...B);
    expect(r.value).toBe("Hello <strong>world</strong>");
    expect(r.value.slice(r.start, r.end)).toBe("world");
  });
  it("inserts a placeholder when nothing is selected", () => {
    const r = wrapSelection("Hi ", 3, 3, "<em>", "</em>", "italic text");
    expect(r.value).toBe("Hi <em>italic text</em>");
    expect(r.value.slice(r.start, r.end)).toBe("italic text");
  });
  it("toggles off when the tags sit just outside the selection", () => {
    const r = wrapSelection("a <strong>b</strong> c", 10, 11, ...B);
    expect(r.value).toBe("a b c");
    expect(r.value.slice(r.start, r.end)).toBe("b");
  });
  it("toggles off when the selection includes the tags", () => {
    const v = "a <u>b</u> c";
    const r = wrapSelection(v, 2, 10, "<u>", "</u>");
    expect(r.value).toBe("a b c");
  });
});
