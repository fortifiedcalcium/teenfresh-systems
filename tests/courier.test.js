import { describe, expect, it } from "vitest";
import { COURIERS, OTHER_COURIER, courierValue } from "../src/lib/orders.js";

describe("courierValue", () => {
  it("accepts a listed courier", () => expect(courierValue(COURIERS[0], "")).toEqual({ value: COURIERS[0] }));
  it("asks for a choice, and for a name when Other is chosen", () => {
    expect(courierValue("", "").error).toMatch(/Choose/);
    expect(courierValue(OTHER_COURIER, "  ").error).toMatch(/Type/);
    expect(courierValue(OTHER_COURIER, " Mr. Speedy ")).toEqual({ value: "Mr. Speedy" });
  });
  it("limits the name to 60 characters", () => expect(courierValue(OTHER_COURIER, "x".repeat(61)).error).toMatch(/60/));
});
