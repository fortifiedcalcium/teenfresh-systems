// Layers of variations, like buying a phone: a product lists its layers (Color, Storage ...) with their values, and every combination is one
// thing that can be bought, with its own optional price. These are the rules for building and checking them.
export const LAYERS_MAX = 3;
export const LAYER_VALUES_MAX = 10;
export const COMBOS_MAX = 60;
export const NAME_MAX = 30;

/** "Black, White\\n Gold" -> ["Black", "White", "Gold"]: trimmed, no empties, no repeats (any capitals). */
export function parseValues(text) {
  const seen = new Set(); const out = [];
  for (const v of String(text ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean)) { if (!seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } }
  return out;
}
/** The layers as the form holds them ({ name, values: "text" } or { name, values: [...] }), without the empty rows. */
export const normalizeLayers = (layers) => (layers || [])
  .map((l) => ({ name: String(l.name ?? "").trim(), values: Array.isArray(l.values) ? parseValues(l.values.join(",")) : parseValues(l.values) }))
  .filter((l) => l.name || l.values.length);

/** Every combination of the layers' values, in order: [{ key, name: "Black / 128GB", options: { Color: "Black", Storage: "128GB" } }]. */
export function buildCombos(layers) {
  const ls = layers.filter((l) => l.name && l.values.length);
  if (!ls.length) return [];
  let acc = [[]];
  for (const l of ls) acc = acc.flatMap((prefix) => l.values.map((v) => [...prefix, v]));
  return acc.map((vals) => ({ key: vals.join("\u0001"), name: vals.join(" / "), options: Object.fromEntries(vals.map((v, i) => [ls[i].name, v])) }));
}
/** The combination key of a saved variation, in the order of the layers (so it matches buildCombos). null if it does not fit the layers. */
export function comboKeyOf(options, layers) {
  const ls = layers.filter((l) => l.name && l.values.length);
  if (!options || !ls.length) return null;
  const vals = ls.map((l) => options[l.name]);
  return vals.every((v) => typeof v === "string" && v) ? vals.join("\u0001") : null;
}

/** A problem with the layers in plain words, or "" when they are fine. */
export function validateLayers(layers) {
  if (layers.length > LAYERS_MAX) return `A product can have up to ${LAYERS_MAX} layers.`;
  const names = new Set();
  for (const l of layers) {
    if (!l.name) return "Give every layer a name, for example Color or Storage, or remove the empty one.";
    if (l.name.length > NAME_MAX) return `The layer name "${l.name.slice(0, 15)}…" is too long: ${NAME_MAX} characters at most.`;
    if (names.has(l.name.toLowerCase())) return `Two layers are called "${l.name}". Give each layer its own name.`;
    names.add(l.name.toLowerCase());
    if (!l.values.length) return `Add at least one value to "${l.name}", separated by commas, for example 128GB, 256GB.`;
    if (l.values.length > LAYER_VALUES_MAX) return `"${l.name}" can have up to ${LAYER_VALUES_MAX} values.`;
    const long = l.values.find((v) => v.length > NAME_MAX);
    if (long) return `The value "${long.slice(0, 15)}…" is too long: ${NAME_MAX} characters at most.`;
  }
  const combos = buildCombos(layers);
  if (combos.length > COMBOS_MAX) return `These layers make ${combos.length} combinations; the most is ${COMBOS_MAX}. Remove a value or a layer.`;
  const tooLong = combos.find((c) => c.name.length > 60);
  if (tooLong) return `The combination "${tooLong.name.slice(0, 20)}…" has a name longer than 60 characters. Use shorter values.`;
  return "";
}

/** Stock: empty = not counted (always available), else a whole number from 0 (sold out) up. */
export const STOCK_MAX = 99999;
export function validateStock(text, name = "this variation") {
  const t = String(text ?? "").trim();
  if (t === "") return "";
  return /^\d+$/.test(t) && Number(t) <= STOCK_MAX ? "" : `The stock of "${name}" must be a whole number from 0 to ${STOCK_MAX.toLocaleString("en-US")}, or empty if you do not count it.`;
}
/** Can this version be bought? Not if its stock is 0. */
export const inStock = (v) => v.stock == null || v.stock > 0;
/** The note beside a version: "Sold out", "Only 3 left" (when it is running low), or nothing. */
export const stockNote = (v) => (v.stock == null ? "" : v.stock === 0 ? "Sold out" : v.stock <= 5 ? `Only ${v.stock} left` : "");
/** Every version is sold out. */
export const allSoldOut = (list) => list.length > 0 && list.every((v) => v.stock === 0);

/** What a product's form will save as variations: the combinations of its layers if it has layers, else the simple list.
 *  Each is { id, name, price, active, options }. */
export function finalVariations(f) {
  const layers = normalizeLayers(f.layers);
  if (layers.length === 0) return (f.variations || []).map((v) => ({ id: v.id || null, name: v.name, price: v.price, stock: v.stock ?? "", active: true, options: null }));
  return buildCombos(layers).map((c) => { const x = (f.combos || {})[c.key] || {}; return { id: x.id || null, name: c.name, price: x.price ?? "", stock: x.stock ?? "", active: x.active !== false, options: c.options }; });
}

/** How a chosen variation reads to a shopper: "Color: Black · Storage: 128GB" for layers, its name for a simple version. */
export const variationLabel = (v) => (v?.options && Object.keys(v.options).length ? Object.entries(v.options).map(([k, x]) => `${k}: ${x}`).join(" · ") : v?.name ?? "");

/** Versions grouped by product id, in the order the admin set. */
export function groupVariations(rows) {
  const out = {};
  for (const r of rows || []) (out[r.product_id] ||= []).push(r);
  for (const k of Object.keys(out)) out[k].sort((a, b) => (a.position - b.position) || String(a.name).localeCompare(String(b.name)));
  return out;
}
