// Every kind of change the log records: the events side first, then the shop.
export const AREAS = {
  events: "Event", event_kits: "Kit", email_templates: "Email template", registrations: "Registration", payments: "Payment", profiles: "User role",
  products: "Product", product_categories: "Product category", couriers: "Courier", shop_settings: "Checkout settings", orders: "Shop order", order_email_templates: "Order email wording",
};
export const VERBS = { insert: "Created", update: "Updated", delete: "Deleted" };

/** One readable line per change: "status: pending → verified". */
export function describe(row) {
  const c = row.changes || {};
  const parts = Object.entries(c).map(([k, v]) => {
    const name = k.replace(/_/g, " ");
    if (v && typeof v === "object" && "new" in v) return `${name}: ${(v as any).old ?? "empty"} → ${(v as any).new ?? "empty"}`;
    return row.action === "update" ? `${name} changed` : `${name}: ${v ?? "empty"}`;
  });
  return parts.length ? parts.join("; ") : "—";
}
