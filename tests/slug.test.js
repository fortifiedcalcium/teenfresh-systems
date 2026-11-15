import { describe, expect, it } from "vitest";
import { eventPath, findByRef, isUuid, productPath, registerPath, slugify } from "../lib/slug.ts";

describe("slugs", () => {
  it("makes lowercase hyphenated slugs, the same rule as the database", () => {
    expect(slugify("IVEMON: ODD PLATINUM Cupsleeve Event")).toBe("ivemon-odd-platinum-cupsleeve-event");
    expect(slugify("  Fan Meet: Dec 12!  ")).toBe("fan-meet-dec-12");
    expect(slugify("ÖRBITAL")).toBe("rbital");
    expect(slugify("???")).toBe("item");
    expect(slugify(null)).toBe("item");
  });
  it("uses the slug in addresses, and the id until a row has one", () => {
    expect(eventPath({ id: "x", slug: "fan-meet" })).toBe("/events/fan-meet");
    expect(registerPath({ id: "x", slug: "fan-meet" })).toBe("/events/fan-meet/register");
    expect(productPath({ id: "abc", slug: null })).toBe("/shop/abc");
  });
  it("finds a row by slug or by its old id address", () => {
    const rows = [{ id: "1", slug: "a" }, { id: "2", slug: "b" }];
    expect(findByRef(rows, "b")?.id).toBe("2");
    expect(findByRef(rows, "1")?.slug).toBe("a");
    expect(findByRef(rows, "nope")).toBeUndefined();
    expect(isUuid("3f9c2a1e-7b4d-4c80-9a52-1e6d8b0f4c77")).toBe(true);
    expect(isUuid("fan-meet")).toBe(false);
  });
});
