import { INFO_SECTIONS } from "./products";
import { comboKeyOf, normalizeLayers } from "./variations";

export const blankProduct = () => ({ id: null, slug: "", artist: "", title: "", price: "", discount_percent: "0", pre_order: false, is_new: true, categories: [], image_path: null, image_alt: "", active: true, info_images: [], variations: [], layers: [], combos: {}, ...Object.fromEntries(INFO_SECTIONS.map(([k]) => [k, ""])) });

export const productToForm = (p, versions = []) => {
  const layers = (p.variation_layers || []).map((l, i) => ({ key: `l${i}`, name: l.name, values: (l.values || []).join(", ") }));
  const norm = normalizeLayers(layers);
  const combos = {};
  if (norm.length) for (const v of versions) { const k = comboKeyOf(v.options, norm); if (k) combos[k] = { id: v.id, price: v.price == null ? "" : String(v.price), stock: v.stock == null ? "" : String(v.stock), active: v.active !== false }; }
  return { ...blankProduct(), ...p, layers, combos, variations: norm.length ? [] : versions.map((v) => ({ key: v.id, id: v.id, name: v.name, price: v.price == null ? "" : String(v.price), stock: v.stock == null ? "" : String(v.stock) })), info_images: p.info_images || [], ...Object.fromEntries(INFO_SECTIONS.map(([k]) => [k, p[k] || ""])), slug: p.slug || "", price: String(p.price), discount_percent: String(p.discount_percent ?? 0), image_alt: p.image_alt || "", categories: p.categories || [] };
};
