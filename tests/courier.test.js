import { describe, expect, it } from "vitest";
import { DEFAULT_COURIERS, OTHER_COURIER, courierValue, splitCourier, validateCourierName } from "../lib/orders";

describe("courierValue", () => {
  it("accepts a listed courier", () => expect(courierValue(DEFAULT_COURIERS[0], "")).toEqual({ value: DEFAULT_COURIERS[0] }));
  it("asks for a choice, and for a name when Other is chosen", () => {
    expect(courierValue("", "").error).toMatch(/Choose/);
    expect(courierValue(OTHER_COURIER, "  ").error).toMatch(/Type/);
    expect(courierValue(OTHER_COURIER, " Mr. Speedy ")).toEqual({ value: "Mr. Speedy" });
  });
  it("limits the name to 60 characters", () => expect(courierValue(OTHER_COURIER, "x".repeat(61)).error).toMatch(/60/));
});

describe("splitCourier", () => {
  const list = ["LBC", "Ninja Van"];
  it("shows a listed courier as itself and anything else as Other", () => {
    expect(splitCourier("LBC", list)).toEqual({ choice: "LBC", other: "" });
    expect(splitCourier("Mr. Speedy", list)).toEqual({ choice: OTHER_COURIER, other: "Mr. Speedy" });     // for example one that was deleted from the list
    expect(splitCourier("", list)).toEqual({ choice: "", other: "" });
  });
});

describe("validateCourierName", () => {
  it("accepts a new name and refuses empty, long, reserved and repeated ones", () => {
    expect(validateCourierName("Entrego", ["LBC"])).toBe("");
    expect(validateCourierName("  ", [])).toMatch(/Type/);
    expect(validateCourierName("x".repeat(61), [])).toMatch(/60/);
    expect(validateCourierName("other", [])).toMatch(/always offered/);
    expect(validateCourierName("lbc", ["LBC"])).toMatch(/already exists/);
  });
});
