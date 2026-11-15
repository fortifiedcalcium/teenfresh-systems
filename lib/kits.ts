/** One problem per field, in plain words. The database checks the same limits (and never trusts the browser). */
export function validateKit(r) {
  const e: Record<string, any> = {};
  if (!r.name.trim()) e.name = "Enter the kit's name";
  else if (r.name.trim().length > 80) e.name = "The name can be 80 characters at most";
  if (!/^\d+(\.\d{1,2})?$/.test(r.unit_price.trim()) || Number(r.unit_price) <= 0) e.unit_price = "Enter a price above 0, with at most 2 decimals";
  return e;
}
