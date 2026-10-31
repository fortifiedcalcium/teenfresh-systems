// POST { kind, payment_id }  kind = "payment_underpaid" | "payment_rejected"   (admin only)
// POST { kind: "acknowledgment", registration_id }                              (the person who submitted, or an admin)
// "We received your registration" is only sent when the event has send_ack_email switched on (off by default).
// Verification emails (the ticket) go through send-confirmation-email.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, getTemplate, resolveBanner, sendRegistrationEmail, serviceClient, sleep } from "../_shared/send.ts";

const KINDS = ["payment_underpaid", "payment_rejected", "acknowledgment"] as const;
type Kind = (typeof KINDS)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  const caller = await getCaller(req, db);
  if (!caller) return json({ error: "Not signed in" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const kind = body.kind as Kind;
  if (!KINDS.includes(kind)) return json({ error: "Unknown kind" }, 400);

  // ---- who and what
  let payment: any = null;
  let regs: any[] = [];
  if (kind === "acknowledgment") {
    const { data: reg } = await db.from("registrations").select("*").eq("id", body.registration_id).maybeSingle();
    if (!reg) return json({ error: "Not found" }, 404);
    if (reg.user_id !== caller.id && !caller.isAdmin) return json({ error: "Not your registration" }, 403);
    if (reg.status !== "pending_verification") return json({ error: "Nothing to acknowledge" }, 400);
    regs = [reg];
    if (reg.payment_id) payment = (await db.from("payments").select("*").eq("id", reg.payment_id).maybeSingle()).data;
    if (!caller.isAdmin) {   // attendees: one acknowledgment per registration, ever
      const { count } = await db.from("email_logs").select("id", { count: "exact", head: true }).eq("registration_id", reg.id).eq("kind", "acknowledgment");
      if ((count ?? 0) > 0) return json({ error: "Already sent" }, 429);
    }
  } else {
    if (!caller.isAdmin) return json({ error: "Admins only" }, 403);
    payment = (await db.from("payments").select("*").eq("id", body.payment_id).maybeSingle()).data;
    if (!payment) return json({ error: "Payment not found" }, 404);
    if (kind === "payment_underpaid" && payment.status !== "underpaid") return json({ error: "Payment is not marked underpaid" }, 400);
    if (kind === "payment_rejected" && payment.status !== "rejected") return json({ error: "Payment is not rejected" }, 400);
    regs = (await db.from("registrations").select("*").eq("payment_id", payment.id).neq("status", "cancelled").order("created_at")).data ?? [];
  }
  if (!regs.length) return json({ results: [] });

  const eventId = regs[0].event_id;
  const { data: event } = await db.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);
  if (kind === "acknowledgment" && !event.send_ack_email) return json({ results: [], skipped: "Acknowledgment emails are switched off for this event" });
  const tpl = await getTemplate(db, eventId, kind);
  if (!tpl) return json({ error: `No "${kind}" email template for this event` }, 400);

  const banner = await resolveBanner(db, event);
  const extra = { reason: payment?.review_note ?? null, amount_paid: payment?.amount_paid, amount_due: payment?.amount_due, reference_number: payment?.reference_number };
  const results = [];
  for (const [i, reg] of regs.entries()) {
    results.push(await sendRegistrationEmail(db, reg, event, tpl, kind, extra, banner));
    if (i < regs.length - 1) await sleep(600);
  }
  return json({ results }, results.length === 1 && results[0].status === "failed" ? 502 : 200);
});
