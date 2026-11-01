// Admin-only bulk mail merge. POST { event_id, filter, template, offset?, limit?, test_to? }
// Recipients are resolved on the server in a stable order and sent in small chunks; the browser
// calls again with next_offset until it is null (keeps each call well under the function time limit).
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, resolveBanner, sendRegistrationEmail, serviceClient, siteUrl, sleep, ticketQrUrl } from "../_shared/send.ts";
import { renderEmail, SAMPLE_EXTRA, SAMPLE_REG } from "../_shared/merge.ts";
import { sendMail } from "../_shared/mailer.ts";

const FILTERS = ["all", "checked_in", "not_checked_in", "email_failed"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = serviceClient();
  const caller = await getCaller(req, db);
  if (!caller) return json({ error: "Not signed in" }, 401);
  if (!caller.isAdmin) return json({ error: "Admins only" }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const tpl = b.template;
  if (!tpl?.subject || !tpl?.html_body || !tpl?.text_body) return json({ error: "Template needs subject, html_body and text_body" }, 400);
  const { data: event } = await db.from("events").select("*").eq("id", b.event_id).maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);

  if (b.test_to) {
    const to = String(b.test_to).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Invalid test address" }, 400);
    let status = "sent", error: string | null = null;
    try { const bn = await resolveBanner(db, event); const qrUrl = await ticketQrUrl(db, `sample-${event.id}`, SAMPLE_REG.ticket_number).catch(() => null); await sendMail({ to, ...renderEmail(tpl, { reg: SAMPLE_REG, event, site: siteUrl(), bannerUrl: bn.url, bannerAlt: bn.alt, qrUrl, extra: SAMPLE_EXTRA }) }); }
    catch (e) { status = "failed"; error = String((e as Error).message).slice(0, 500); }
    await db.from("email_logs").insert({ registration_id: null, recipient: to, kind: "test", status, error });
    return json({ status, error }, status === "sent" ? 200 : 502);
  }

  const filter = FILTERS.includes(b.filter) ? b.filter : "all";
  // deno-lint-ignore no-explicit-any
  let q: any = db.from("registrations").select("*").eq("event_id", event.id).eq("status", "confirmed").not("ticket_number", "is", null).order("created_at").order("id");
  if (filter === "checked_in") q = q.not("checked_in_at", "is", null);
  if (filter === "not_checked_in") q = q.is("checked_in_at", null);
  const { data: all } = await q;
  let recipients = all ?? [];
  if (filter === "email_failed") {
    const { data: st } = await db.from("registration_email_status").select("registration_id,status").eq("event_id", event.id);
    const failed = new Set((st ?? []).filter((s) => s.status === "failed").map((s) => s.registration_id));
    recipients = recipients.filter((r: { id: string }) => failed.has(r.id));
  }

  const offset = Math.max(0, Number(b.offset) || 0);
  const limit = Math.min(40, Math.max(1, Number(b.limit) || 25));
  const chunk = recipients.slice(offset, offset + limit);
  const results = [];
  const banner = await resolveBanner(db, event);
  for (const [i, reg] of chunk.entries()) {
    results.push(await sendRegistrationEmail(db, reg, event, tpl, "bulk", undefined, banner));
    if (i < chunk.length - 1) await sleep(600);
  }
  const next = offset + chunk.length;
  return json({ total: recipients.length, processed: next, sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length, next_offset: next < recipients.length ? next : null });
});
