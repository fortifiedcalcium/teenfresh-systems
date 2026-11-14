// Builds src/data/ph-locations.json: { "Province": ["City or municipality", ...] } from the Philippine Standard Geographic Code (PSGC),
// the Philippine Statistics Authority's official list, through the public PSGC API. Run it again only to refresh the data:
//   node scripts/build-ph-locations.mjs
import fs from "node:fs";

const API = "https://psgc.gitlab.io/api";
const get = async (p) => { const r = await fetch(`${API}/${p}/`); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };

const [provinces, places] = await Promise.all([get("provinces"), get("cities-municipalities")]);
const byCode = new Map(provinces.map((p) => [p.code, p.name]));
const NCR = "Metro Manila (NCR)";
// The PSGC lists a few cities with no province. Mail is addressed to them under these provinces.
const NO_PROVINCE = { "City of Isabela": "Basilan", "City of Cotabato": "Maguindanao del Norte" };
// "City of Makati" is written "Makati City" on addresses.
const nice = (name) => (name.startsWith("City of ") ? `${name.slice(8)} City` : name);

const out = {};
for (const c of places) {
  const province = c.provinceCode ? byCode.get(c.provinceCode) : c.regionCode === "130000000" ? NCR : NO_PROVINCE[c.name];
  if (!province) throw new Error(`No province for ${c.name} (${c.code})`);
  (out[province] ||= []).push(nice(c.name));
}
for (const p of [...byCode.values(), "Basilan", "Maguindanao del Norte"]) if (!out[p]) throw new Error(`Province ${p} has no cities`);

const sorted = Object.fromEntries(Object.keys(out).sort((a, b) => a.localeCompare(b, "en")).map((p) => [p, [...new Set(out[p])].sort((a, b) => a.localeCompare(b, "en"))]));
fs.writeFileSync(new URL("../src/data/ph-locations.json", import.meta.url), JSON.stringify(sorted));
const count = Object.values(sorted).reduce((n, l) => n + l.length, 0);
console.log(`src/data/ph-locations.json: ${Object.keys(sorted).length} provinces, ${count} cities and municipalities`);
