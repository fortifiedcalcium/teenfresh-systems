// POST { registration_id } | { registration_ids: [...] } | { test_to, event_id, template? }
//  - registration_id: the owner (right after registering / "Resend") or an admin
//  - registration_ids, test_to: admin only
// Always verified with the caller's JWT; data is read with the service role.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, getTemplate, resolveBanner, sendRegistrationEmail, serviceClient, siteUrl, sleep, ticketQrUrl } from "../_shared/send.ts";
import { renderEmail, SAMPLE_EXTRA, SAMPLE_REG } from "../_shared/merge.ts";
import { sendMail } from "../_shared/mailer.ts";

const MAX_BATCH = 50;            // Resend allows ~2 requests/second, so batches stay small
const RESEND_COOLDOWN_MS = 60_000;
const RESEND_PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  const caller = await getCaller(req, db);
  if (!caller) return json({ error: "Not signed in" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // ---- admin: send a test copy of a template to an inbox
  if (body.test_to) {
    if (!caller.isAdmin) return json({ error: "Admins only" }, 403);
    const to = String(body.test_to).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Invalid test address" }, 400);
    const { data: event } = await db.from("events").select("*").eq("id", body.event_id).maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);
    const kind = ["confirmation", "payment_underpaid", "payment_rejected", "acknowledgment"].includes(body.kind) ? body.kind : "confirmation";
    const tpl = body.template ?? (await getTemplate(db, event.id, kind));
    if (!tpl) return json({ error: "No template" }, 400);
    let status: "sent" | "failed" = "sent", error: string | null = null;
    try {
      const b = await resolveBanner(db, event);
      const qrUrl = await ticketQrUrl(db, `sample-${event.id}`, SAMPLE_REG.ticket_number).catch(() => null);
      await sendMail({ to, ...renderEmail(tpl, { reg: SAMPLE_REG, event, site: siteUrl(), bannerUrl: b.url, bannerAlt: b.alt, qrUrl, ensureQr: kind === "confirmation", extra: SAMPLE_EXTRA }) });
    } catch (e) { status = "failed"; error = String((e as Error).message).slice(0, 500); }
    await db.from("email_logs").insert({ registration_id: null, recipient: to, kind: "test", status, error });
    return json({ results: [{ id: null, status, error }] }, status === "sent" ? 200 : 502);
  }

  const ids: string[] = Array.isArray(body.registration_ids) ? body.registration_ids : body.registration_id ? [body.registration_id] : [];
  if (!ids.length) return json({ error: "registration_id required" }, 400);
  if (ids.length > MAX_BATCH) return json({ error: `At most ${MAX_BATCH} per call` }, 400);
  if (ids.length > 1 && !caller.isAdmin) return json({ error: "Admins only" }, 403);

  const { data: regs } = await db.from("registrations").select("*").in("id", ids);
  const results: unknown[] = [];
  const tplCache = new Map<string, any>();
  const eventCache = new Map<string, any>();

  for (const [i, id] of ids.entries()) {
    const reg = regs?.find((r) => r.id === id);
    if (!reg) { results.push({ id, status: "failed", error: "Not found" }); continue; }
    if (!caller.isAdmin) {
      if (reg.user_id !== caller.id) return json({ error: "Not your registration" }, 403);
      // Rate limit for attendees: 1 per minute, 5 per hour.
      const since = new Date(Date.now() - 3_600_000).toISOString();
      const { data: recent } = await db.from("email_logs").select("sent_at").eq("registration_id", id).eq("kind", "confirmation").gte("sent_at", since).order("sent_at", { ascending: false });
      if (recent?.length && Date.now() - new Date(recent[0].sent_at).getTime() < RESEND_COOLDOWN_MS)
        return json({ error: "Please wait a minute before requesting another email." }, 429);
      if ((recent?.length ?? 0) >= RESEND_PER_HOUR) return json({ error: "Too many emails requested. Try again later." }, 429);
    }
    if (reg.status !== "confirmed") { results.push({ id, status: "failed", error: "Registration is cancelled" }); continue; }
    if (!eventCache.has(reg.event_id)) {
      eventCache.set(reg.event_id, (await db.from("events").select("*").eq("id", reg.event_id).maybeSingle()).data);
      tplCache.set(reg.event_id, await getTemplate(db, reg.event_id, "confirmation"));
    }
    const event = eventCache.get(reg.event_id), tpl = tplCache.get(reg.event_id);
    if (!event || !tpl) { results.push({ id, status: "failed", error: "No email template for this event" }); continue; }
    results.push(await sendRegistrationEmail(db, reg, event, tpl, "confirmation"));
    if (i < ids.length - 1) await sleep(600);
  }
  const failed = (results as any[]).some((r) => r.status === "failed");
  return json({ results }, failed && results.length === 1 ? 502 : 200);
});
