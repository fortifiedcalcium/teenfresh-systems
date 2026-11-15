/** Runs a zod schema over the form values and returns { field: first message } (an empty object when everything is valid). */
export function zodErrors(schema, values) {
  const res = schema.safeParse(values);
  if (res.success) return {};
  const out = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] ?? "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
