import { describe, expect, it } from "vitest";
import places from "../data/ph-locations.json";

describe("Philippine locations (PSGC)", () => {
  const provinces = Object.keys(places);
  it("covers the whole country", () => {
    expect(provinces.length).toBeGreaterThanOrEqual(81);
    expect(Object.values(places).flat().length).toBeGreaterThan(1600);       // 1,634 cities and municipalities
    expect(places["Metro Manila (NCR)"]).toHaveLength(17);                    // 16 cities and Pateros
  });
  it("lists well-known places under the right province", () => {
    expect(places["Cebu"]).toEqual(expect.arrayContaining(["Cebu City", "Lapu-Lapu City"]));
    expect(places["Metro Manila (NCR)"]).toContain("Makati City");
    expect(places["Metro Manila (NCR)"]).toContain("Pateros");
    expect(places["Pampanga"]).toContain("Angeles City");
    expect(places["Basilan"]).toContain("Isabela City");
    expect(places["Maguindanao del Norte"]).toContain("Cotabato City");
  });
  it("has no empty province, blank name or repeated city in a province", () => {
    for (const [p, list] of Object.entries(places)) {
      expect(list.length, p).toBeGreaterThan(0);
      expect(new Set(list).size, p).toBe(list.length);
      for (const c of list) expect(c.trim() && !c.startsWith("City of "), `${p}: ${c}`).toBeTruthy();
    }
  });
  it("is sorted for the dropdowns", () => {
    expect(provinces).toEqual([...provinces].sort((a, b) => a.localeCompare(b, "en")));
  });
});
