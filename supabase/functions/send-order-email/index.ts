// POST { kind, order_id }
//   kind "order_received"                                         the person who placed the order (or an admin), once per order
//   kind "order_paid" | "order_shipped" | "order_cancelled"       admin only, and only while the order is in that status
// The email goes to the address saved on the order. Every attempt is written to order_emails.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, serviceClient, siteUrl } from "../_shared/send.ts";
import { sendMail } from "../_shared/mailer.ts";
import { KIND_STATUS, ORDER_KINDS, OrderKind, renderOrderEmail } from "../_shared/orderEmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = serviceClient();
  const caller = await getCaller(req, db);
  if (!caller) return json({ error: "Not signed in" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const kind = body.kind as OrderKind;
  if (!ORDER_KINDS.includes(kind)) return json({ error: "Unknown kind" }, 400);

  const { data: order } = await db.from("orders").select("*").eq("id", body.order_id).maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);
  if (kind === "order_received") {
    if (order.user_id !== caller.id && !caller.isAdmin) return json({ error: "Not your order" }, 403);
    if (!caller.isAdmin) {   // shoppers: one confirmation per order, ever
      const { count } = await db.from("order_emails").select("id", { count: "exact", head: true }).eq("order_id", order.id).eq("kind", kind);
      if ((count ?? 0) > 0) return json({ error: "Already sent" }, 429);
    }
  } else {
    if (!caller.isAdmin) return json({ error: "Admins only" }, 403);
    if (order.status !== KIND_STATUS[kind]) return json({ error: `The order is not ${KIND_STATUS[kind]}` }, 400);
  }

  const { data: custom } = await db.from("order_email_templates").select("subject,heading,body").eq("kind", kind).maybeSingle();   // none = the built-in wording
  const { data: items } = await db.from("order_items").select("artist,title,unit_price_usd,quantity").eq("order_id", order.id).order("title");
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    await sendMail({ to: order.email, ...renderOrderEmail(kind, order, items ?? [], siteUrl(), custom) });
  } catch (e) {
    status = "failed";
    error = String((e as Error)?.message ?? e).slice(0, 500);
  }
  await db.from("order_emails").insert({ order_id: order.id, kind, recipient: order.email, status, error });
  return json({ status, error }, status === "failed" ? 502 : 200);
});
