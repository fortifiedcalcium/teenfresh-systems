export interface ProductRow {
  id: string; slug?: string | null; artist: string; title: string; price: number | string; discount_percent: number; pre_order: boolean; is_new: boolean;
  categories: string[]; image_path: string | null; image_alt: string | null; active: boolean; created_at?: string; variation_layers?: { name: string; values: string[] }[];
  info_images?: string[]; [key: string]: unknown;
}
export interface VariationRow { id: string; product_id: string; name: string; price: number | string | null; stock: number | null; active?: boolean; position?: number; options?: Record<string, string> | null }
