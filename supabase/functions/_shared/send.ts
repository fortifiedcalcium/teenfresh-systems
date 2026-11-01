import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail, Template } from "./merge.ts";
import { sendMail } from "./mailer.ts";
import { ticketQrPng } from "./qr.ts";

export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export const siteUrl = () => Deno.env.get("PUBLIC_SITE_URL") ?? "";
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Who is calling? Returns the user id and whether they are an admin (checked with the service role). */
export async function getCaller(req: Request, db: SupabaseClient) {
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  const user = data?.user;
  if (!user) return null;
  const { data: p } = await db.from("profiles").select("role,email").eq("id", user.id).maybeSingle();
  return { id: user.id, email: p?.email || user.email || "", isAdmin: p?.role === "admin" };
}

export type EmailKind = "confirmation" | "payment_underpaid" | "payment_rejected" | "acknowledgment";

export const getTemplate = async (db: SupabaseClient, eventId: string, kind: EmailKind = "confirmation"): Promise<Template | null> =>
  (await db.from("email_templates").select("subject,html_body,text_body").eq("event_id", eventId).eq("kind", kind).maybeSingle()).data;

/** The image shown at the top of emails: the event's email_banner slot, else its banner slot, else the legacy banner_url.
 *  Images come from the public event-media bucket (or an external URL), so no signing is needed. */
export async function resolveBanner(db: SupabaseClient, event: { id: string; banner_url?: string | null; title?: string }) {
  const { data } = await db.from("event_images").select("slot,storage_path,external_url,alt_text").eq("event_id", event.id).in("slot", ["email_banner", "banner"]);
  const pick = data?.find((r) => r.slot === "email_banner") ?? data?.find((r) => r.slot === "banner");
  if (!pick) return { url: event.banner_url ?? null, alt: event.title ?? null };
  const url = pick.storage_path ? db.storage.from("event-media").getPublicUrl(pick.storage_path).data.publicUrl : pick.external_url;
  return { url, alt: pick.alt_text || event.title || null };
}

/** The emailed QR code. Mail apps cannot run scripts, so it is a PNG (ticket number + Teenfresh logo) kept in the public
 *  event-media bucket under qr/<registration id>.png: an unguessable name that stays the same when the email is resent. */
export async function ticketQrUrl(db: SupabaseClient, key: string, ticket: string): Promise<string> {
  const path = `qr/${key}.png`;
  const { error } = await db.storage.from("event-media").upload(path, await ticketQrPng(ticket), { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`QR image upload failed: ${error.message}`);
  return db.storage.from("event-media").getPublicUrl(path).data.publicUrl;
}

/** Merge, send and log one email. Never throws: the outcome is returned and written to email_logs. */
export async function sendRegistrationEmail(
  db: SupabaseClient, reg: any, event: any, tpl: Template, kind: "confirmation" | "bulk" | "payment_underpaid" | "payment_rejected" | "acknowledgment",
  extra?: { reason?: string | null; amount_paid?: number | string | null; amount_due?: number | string | null; reference_number?: string | null },
  banner?: { url: string | null; alt: string | null },
) {
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  let note: string | null = null;
  try {
    const b = banner ?? await resolveBanner(db, event);
    let qrUrl: string | null = null;
    if (reg.ticket_number) {
      try { qrUrl = await ticketQrUrl(db, reg.id, reg.ticket_number); }
      catch (e) { note = String((e as Error)?.message ?? e).slice(0, 300); }   // send the email anyway, and say so in the log
    }
    const mail = renderEmail(tpl, { reg, event, site: siteUrl(), bannerUrl: b.url, bannerAlt: b.alt, qrUrl, ensureQr: kind === "confirmation", extra });
    await sendMail({ to: reg.email, ...mail });
    error = note;
  } catch (e) {
    status = "failed";
    error = String((e as Error)?.message ?? e).slice(0, 500);
  }
  await db.from("email_logs").insert({ registration_id: reg.id, recipient: reg.email, kind, status, error });
  return { id: reg.id as string, status, error };
}
