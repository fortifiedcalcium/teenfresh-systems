#!/usr/bin/env node
// Deletes payment receipt files (and clears their references) a set number of days after each event, using the
// per-event "Delete payment receipts N days after the event" setting (Admin > Events). Receipts are personal data.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-receipts.mjs          # dry run
//   SUPABASE_URL=...                       SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-receipts.mjs --apply   # delete
//
// It needs the service-role key (storage deletes bypass the admin-only policy), so run it from your own machine or a
// scheduled job, never in the browser, and never paste the key anywhere. It prints counts only, no names or file paths.
import { pathToFileURL } from "node:url";

const DAY = 86_400_000;

/** Pure decision logic (unit-tested): which events are past their retention date, and which files belong to them. */
export function planPurge(events, payments, now = Date.now()) {
  const due = events.filter((e) => e.receipt_retention_days != null && now > new Date(e.ends_at || e.event_date).getTime() + e.receipt_retention_days * DAY);
  const dueIds = new Set(due.map((e) => e.id));
  const rows = payments.filter((p) => dueIds.has(p.event_id) && (p.receipt_path || p.receipt_history?.length));
  const paths = [...new Set(rows.flatMap((p) => [p.receipt_path, ...(p.receipt_history || [])]).filter(Boolean))];
  return { events: due.length, payments: rows.map((p) => p.id), paths };
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = process.argv.includes("--apply");
  if (!url || !key) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const get = async (path) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: h }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };

  const events = await get("events?select=id,event_date,ends_at,receipt_retention_days&receipt_retention_days=not.is.null");
  const payments = await get("payments?select=id,event_id,receipt_path,receipt_history&or=(receipt_path.not.is.null,receipt_history.neq.{})&limit=100000");
  const plan = planPurge(events, payments);
  console.log(`${plan.events} event(s) past their retention date; ${plan.paths.length} receipt file(s) on ${plan.payments.length} payment(s).`);
  if (!plan.paths.length) return;
  if (!apply) { console.log("Dry run: nothing deleted. Add --apply to delete."); return; }

  for (let i = 0; i < plan.paths.length; i += 100) {
    const r = await fetch(`${url}/storage/v1/object/payment-receipts`, { method: "DELETE", headers: h, body: JSON.stringify({ prefixes: plan.paths.slice(i, i + 100) }) });
    if (!r.ok) throw new Error(`storage delete failed: ${r.status}`);
  }
  for (let i = 0; i < plan.payments.length; i += 100) {
    const ids = plan.payments.slice(i, i + 100).join(",");
    const r = await fetch(`${url}/rest/v1/payments?id=in.(${ids})`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ receipt_path: null, receipt_history: [], receipt_deleted_at: new Date().toISOString() }) });
    if (!r.ok) throw new Error(`payments update failed: ${r.status}`);
  }
  console.log(`Deleted ${plan.paths.length} file(s) and cleared ${plan.payments.length} payment record(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e.message); process.exit(1); });
