import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

// Runs the real migrations (schema.sql, then 002_registration_payments.sql) in Postgres (PGlite) with small
// stand-ins for what Supabase provides: auth schema + auth.uid(), anon/authenticated roles, the realtime
// publication, and the storage schema (buckets, objects with RLS, foldername()).
const read = (f) => fs.readFileSync(new URL("../supabase/migrations/" + f, import.meta.url), "utf8");
const STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid(), created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
`;

let db;
const ids = {};

const asUser = async (key) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${ids[key] ?? ""}', false); set role ${key ? "authenticated" : "anon"};`);
};
const asSuper = () => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
const fails = async (p, code) => { await expect(p).rejects.toThrow(code); };

const mkUser = async (name, admin = false) => {
  const r = await db.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [`${name}@example.com`, JSON.stringify({ full_name: name })]);
  ids[name] = r.rows[0].id;
  if (admin) await db.exec(`update public.profiles set role = 'admin' where id = '${ids[name]}'`);
};
let evCount = 0;
/** A fresh event with its own ticket prefix, so tests do not depend on today's date or on each other. */
const mkEvent = async ({ capacity = 10, fee = 100, deadlineDays = 5, open = true } = {}) => {
  await asSuper();
  const prefix = "T" + String(++evCount).padStart(3, "0");
  const r = await db.query(
    `insert into public.events (title, event_date, capacity, ticket_prefix, registration_fee, registration_deadline, registration_open)
     values ($1, now() + interval '30 days', $2, $3, $4, now() + ($5 || ' days')::interval, $6) returning id`,
    ["Test " + prefix, capacity, prefix, fee, String(deadlineDays), open]);
  return r.rows[0].id;
};
const rcpt = (user) => `${ids[user]}/${randomUUID()}.jpg`;
const defaults = (user, ev, o = {}) => ({
  name: "Juan Dela Cruz", x: "@" + user + "_x", email: user + "@example.com", fb: "fb.com/TeenfreshPH", phone: "09171234567", notes: null, agreed: true,
  payment_id: null, sender: "Juan D.", amount: 100, ref: String(Math.floor(1e12 + Math.random() * 9e12)), receipt: rcpt(user), kit: null, qty: 1, ...o,
});
const submit = async (user, ev, o = {}) => {
  const a = defaults(user, ev, o);
  const r = await db.query("select public.submit_registration($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) as r",
    [ev, a.name, a.x, a.email, a.fb, a.phone, a.notes, a.agreed, a.payment_id, a.payment_id ? null : a.sender, a.payment_id ? null : a.amount, a.payment_id ? null : a.ref, a.payment_id ? null : a.receipt, a.kit, a.qty]);
  return r.rows[0].r;
};
const review = async (admin, paymentId, decision, reason = null, override = false, due = null) => {
  await asUser(admin);
  return (await db.query("select public.review_payment($1,$2,$3,$4,$5) as r", [paymentId, decision, reason, override, due])).rows[0].r;
};
const row = async (sql, params) => { await asSuper(); return (await db.query(sql, params)).rows[0]; };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(read("schema.sql"));
  await db.exec(read("002_registration_payments.sql"));
  await db.exec(read("003_kits.sql"));
  await db.exec(read("004_change_log.sql"));
  await db.exec(read("005_underpayment_top_up.sql"));
  await db.exec(read("006_one_kit_per_form.sql"));
  await db.exec(read("007_free_reference_number.sql"));
  await db.exec(read("008_banner_coming_soon.sql"));
  await db.exec(read("009_upload_limit_10mb.sql"));
  for (const k of ["alice", "bob", "carol", "dave", "erin", "frank", "gina", "hank", "ivy", "jack", "kim", "lee", "max", "ned"]) await mkUser(k);
  await mkUser("admin", true);
});

describe("accounts", () => {
  it("creates an attendee profile for every new auth user, and users cannot change their role", async () => {
    await asUser("alice");
    await db.exec("update public.profiles set full_name = 'Alice B', role = 'admin' where id = auth.uid()");
    expect(await row("select role, full_name from public.profiles where id = $1", [ids.alice])).toEqual({ role: "attendee", full_name: "Alice B" });
  });
});

describe("seed and migration", () => {
  it("seeds ODD PLATINUM with the reference details", async () => {
    const e = await row("select * from public.events where title = 'IVEMON: ODD PLATINUM Cupsleeve Event'");
    expect(e).toMatchObject({ subtitle: "IVE's Kim Gaeul Cupsleeve Event hosted by Teenfresh", venue: "Psicom Blue Club", venue_address: "6 Yale St., Cubao, Quezon City, Philippines, 1109", payment_account_number: "09XXXXXXXXX", payment_account_name: "BR**N CA**O S." });
    expect(Number(e.registration_fee)).toBe(100);
    expect(e.hashtags).toEqual(["#IVEMON_OP", "#Teenfresh", "#IVE", "#Gaeul"]);
    expect(e.kit_inclusions).toEqual(["(1) Cupsleeve", "(1) Trading Card", "(2) Mezastar Tags"]);
    expect(e.contact_links.map((l) => l.label)).toEqual(["Facebook", "X", "Instagram", "TikTok", "Gmail"]);
    expect(e.terms_html).toContain("<strong>NO CANCELLATION</strong>");
    expect(e.terms_html).toContain("<strong>1 Form = 1 Entry per person only</strong>");
    expect((e.terms_html.match(/<li>/g) || []).length).toBe(10);
    expect(new Date(e.registration_deadline).toISOString()).toBe("2026-09-30T15:59:59.000Z"); // end of day, Asia/Manila
    expect(new Date(e.event_date).toISOString()).toBe("2026-10-04T06:00:00.000Z");            // 2:00 PM Manila
  });
  it("the older event kept its data: terms copied to HTML, banner moved to the banner slot, all email templates present", async () => {
    const e = await row("select id, terms_html from public.events where ticket_prefix = 'IVEMON'");
    expect(e.terms_html).toContain("<ol><li>Strictly NO CANCELLATION");
    expect((await row("select slot, external_url from public.event_images where event_id = $1", [e.id]))).toEqual({ slot: "banner", external_url: "/banners/ivemon.png" });
    await asSuper();
    const kinds = (await db.query("select kind from public.email_templates where event_id = $1 order by kind", [e.id])).rows.map((r) => r.kind);
    expect(kinds).toEqual(["acknowledgment", "confirmation", "payment_rejected", "payment_underpaid"]);
  });
  it("every new event gets the four default templates, with the event title merged in, not hard-coded", async () => {
    const ev = await mkEvent();
    const t = (await db.query("select kind, subject, html_body from public.email_templates where event_id = $1", [ev])).rows;
    expect(t).toHaveLength(4);
    const c = t.find((x) => x.kind === "confirmation");
    expect(c.subject).toBe("Confirmation email - {{Event Title}}");
    expect(c.html_body).toContain("{{Terms}}");
    expect(c.html_body).toContain("{{Banner}}");
    expect(c.html_body).not.toContain("IVEMON");
  });
});

describe("submit_registration", () => {
  it("creates a pending registration and a pending payment: no ticket yet", async () => {
    const ev = await mkEvent();
    await asUser("alice");
    const r = await submit("alice", ev, { x: "@Alice_X", fb: "https://m.facebook.com/alice.fb", phone: "+639171234567" });
    expect(r.status).toBe("pending_verification");
    expect(r.ticket_number).toBeNull();
    await asSuper();
    const reg = (await db.query("select * from public.registrations where id = $1", [r.registration_id])).rows[0];
    expect(reg).toMatchObject({ x_username: "Alice_X", facebook_url: "https://www.facebook.com/alice.fb", contact_number: "+639171234567", ticket_number: null, status: "pending_verification" });
    expect(reg.terms_accepted_at).not.toBeNull();
    const pay = (await db.query("select * from public.payments where id = $1", [r.payment_id])).rows[0];
    expect(pay).toMatchObject({ status: "pending", method: "gcash", sender_name: "Juan D." });
    expect(Number(pay.amount_paid)).toBe(100);
    expect(reg.payment_id).toBe(pay.id);
  });

  it("normalises the contact number, Facebook link, X username and reference number", async () => {
    const ev = await mkEvent();
    await asUser("bob");
    const r = await submit("bob", ev, { x: "@@bob_x", fb: "FB.com/Bob.Profile", phone: "0917 123-4567", ref: "1234 5678 9012 3" });
    await asSuper();
    expect((await db.query("select x_username, facebook_url, contact_number from public.registrations where id = $1", [r.registration_id])).rows[0])
      .toEqual({ x_username: "bob_x", facebook_url: "https://www.facebook.com/Bob.Profile", contact_number: "+639171234567" });
    expect((await db.query("select reference_number from public.payments where id = $1", [r.payment_id])).rows[0].reference_number).toBe("1234567890123");
  });

  it("validates every field on the server", async () => {
    const ev = await mkEvent();
    await asUser("carol");
    await fails(submit("carol", ev, { agreed: false }), "TERMS_NOT_ACCEPTED");
    await fails(submit("carol", ev, { name: " " }), "INVALID_NAME");
    await fails(submit("carol", ev, { x: "not valid!" }), "INVALID_X_USERNAME");
    await fails(submit("carol", ev, { email: "nope" }), "INVALID_EMAIL");
    await fails(submit("carol", ev, { fb: "twitter.com/x" }), "INVALID_FACEBOOK");
    await fails(submit("carol", ev, { fb: "https://evil.com/facebook.com/x" }), "INVALID_FACEBOOK");
    await fails(submit("carol", ev, { phone: "12345" }), "INVALID_CONTACT");
    await fails(submit("carol", ev, { notes: "x".repeat(501) }), "INVALID_NOTES");
    await fails(submit("carol", ev, { sender: "" }), "INVALID_SENDER");
    await fails(submit("carol", ev, { amount: 99.99 }), "AMOUNT_TOO_LOW");
    await fails(submit("carol", ev, { ref: "   " }), "INVALID_REFERENCE");
    await fails(submit("carol", ev, { ref: "a".repeat(65) }), "INVALID_REFERENCE");
    await fails(submit("carol", ev, { receipt: "carol/receipt.jpg" }), "INVALID_RECEIPT");
    await fails(submit("carol", ev, { receipt: `${ids.bob}/${randomUUID()}.jpg` }), "INVALID_RECEIPT");   // someone else's folder
    await fails(submit("carol", ev, { receipt: `${ids.carol}/${randomUUID()}.exe` }), "INVALID_RECEIPT");
    await fails(submit("carol", ev, { receipt: `${ids.carol}/../${ids.bob}/${randomUUID()}.jpg` }), "INVALID_RECEIPT");
    await fails(submit("carol", "00000000-0000-0000-0000-000000000000"), "EVENT_NOT_FOUND");
    await asUser(null);
    await expect(db.query("select public.submit_registration($1,'a','b','c@d.ef','fb.com/x','09171234567',null,true)", [ev])).rejects.toThrow(/permission denied|AUTH_REQUIRED/);
  });

  it("one active entry per X username per event (case-insensitive), and the same username can enter another event", async () => {
    const ev = await mkEvent(), ev2 = await mkEvent();
    await asUser("dave");
    await submit("dave", ev, { x: "Dup_User" });
    await fails(submit("dave", ev, { x: "dup_user" }), "ALREADY_REGISTERED");
    await asUser("erin");
    await fails(submit("erin", ev, { x: "DUP_USER" }), "ALREADY_REGISTERED");
    await asUser("erin");
    await submit("erin", ev2, { x: "DUP_USER" });
  });

  it("a user may submit several forms for different people", async () => {
    const ev = await mkEvent();
    await asUser("frank");
    await submit("frank", ev, { x: "friend_one" });
    await submit("frank", ev, { x: "friend_two" });
    await asSuper();
    expect(Number((await db.query("select count(*) from public.registrations where event_id = $1 and user_id = $2", [ev, ids.frank])).rows[0].count)).toBe(2);
  });

  it("refuses a reference number that was used before, even from another user", async () => {
    const ev = await mkEvent();
    await asUser("gina"); await submit("gina", ev, { x: "gina_x", ref: "5550001112223" });
    await asUser("hank"); await fails(submit("hank", ev, { x: "hank_x", ref: "5550001112223" }), "DUPLICATE_REFERENCE");
  });

  it("is blocked after the deadline, when closed by the admin, and when the event has started", async () => {
    const late = await mkEvent({ deadlineDays: -1 }), closed = await mkEvent({ open: false });
    const past = (await db.query("insert into public.events (title, event_date, capacity, ticket_prefix) values ('Past', now() - interval '1 day', 5, 'PAST') returning id")).rows[0].id;
    await asUser("ivy");
    await fails(submit("ivy", late), "REGISTRATION_CLOSED");
    await fails(submit("ivy", closed), "REGISTRATION_CLOSED");
    await fails(submit("ivy", past), "REGISTRATION_CLOSED");
  });
});

describe("capacity", () => {
  it("pending forms hold a slot; rejection releases it; the public counter follows", async () => {
    const ev = await mkEvent({ capacity: 2 });
    await asUser("alice"); const a = await submit("alice", ev, { x: "cap_a" });
    await asUser("bob");   await submit("bob", ev, { x: "cap_b" });
    await asUser("carol"); await fails(submit("carol", ev, { x: "cap_c" }), "SOLD_OUT");
    await asUser(null);
    expect(Number((await db.query("select slots_left from public.event_availability where event_id = $1", [ev])).rows[0].slots_left)).toBe(0);
    await review("admin", a.payment_id, "rejected", "Receipt unreadable");
    await asUser(null);
    expect(Number((await db.query("select slots_left from public.event_availability where event_id = $1", [ev])).rows[0].slots_left)).toBe(1);
    await asUser("carol"); await submit("carol", ev, { x: "cap_c" });
  });
});

describe("shared payments", () => {
  it("a payment covers forms until its balance is used up: two forms on 200 PHP, the third is refused, other users cannot use it", async () => {
    const ev = await mkEvent();
    await asUser("dave");
    const first = await submit("dave", ev, { x: "share_1", amount: 200 });
    const second = await submit("dave", ev, { x: "share_2", payment_id: first.payment_id });
    expect(second.payment_id).toBe(first.payment_id);
    await fails(submit("dave", ev, { x: "share_3", payment_id: first.payment_id }), "PAYMENT_BALANCE_TOO_LOW");
    await asUser("erin");
    await fails(submit("erin", ev, { x: "share_4", payment_id: first.payment_id }), "INVALID_PAYMENT");
  });
  it("a cancelled form frees its share of the payment", async () => {
    const ev = await mkEvent();
    await asUser("frank");
    const a = await submit("frank", ev, { x: "cov_1", amount: 100 });
    await asSuper();
    await db.query("update public.registrations set status = 'cancelled' where id = $1", [a.registration_id]);
    await asUser("frank");
    await submit("frank", ev, { x: "cov_2", payment_id: a.payment_id });
  });
});

describe("review_payment", () => {
  it("is admin only", async () => {
    const ev = await mkEvent();
    await asUser("gina"); const a = await submit("gina", ev, { x: "rv_1" });
    await asUser("gina");
    await fails(db.query("select public.review_payment($1,'verified')", [a.payment_id]), "FORBIDDEN");
  });

  it("verifying confirms every linked form, assigns sequential tickets and a verified payment confirms later forms at once", async () => {
    const ev = await mkEvent();
    await asUser("hank");
    const a = await submit("hank", ev, { x: "ver_1", amount: 300 });
    const b = await submit("hank", ev, { x: "ver_2", payment_id: a.payment_id });
    const out = await review("admin", a.payment_id, "verified");
    expect(out.ticket_numbers).toEqual([expect.stringMatching(/^T\d{3}-\d{6}$/), expect.stringMatching(/^T\d{3}-\d{6}$/)]);
    expect(out.registration_ids.sort()).toEqual([a.registration_id, b.registration_id].sort());
    await asSuper();
    const regs = (await db.query("select status, ticket_number from public.registrations where payment_id = $1 order by created_at", [a.payment_id])).rows;
    expect(regs.every((r) => r.status === "confirmed" && r.ticket_number)).toBe(true);
    expect(new Set(regs.map((r) => r.ticket_number)).size).toBe(2);
    expect((await db.query("select status, reviewed_at from public.payments where id = $1", [a.payment_id])).rows[0].status).toBe("verified");
    await asUser("hank");
    const c = await submit("hank", ev, { x: "ver_3", payment_id: a.payment_id });   // coverage 3: the third form joins a verified payment
    expect(c.status).toBe("confirmed");
    expect(c.ticket_number).toMatch(/^T\d{3}-\d{6}$/);
    await asUser("admin");
    await fails(db.query("select public.review_payment($1,'verified')", [a.payment_id]), "ALREADY_REVIEWED");
  });

  it("refuses to verify an amount below the forms' total unless the admin overrides with a reason", async () => {
    const ev = await mkEvent();
    await asUser("ivy"); const a = await submit("ivy", ev, { x: "ovr_1" });
    await asSuper(); await db.query("update public.payments set amount_paid = 80 where id = $1", [a.payment_id]);   // the money received is short of the 100 ordered
    await fails(review("admin", a.payment_id, "verified"), "INSUFFICIENT_AMOUNT");
    await fails(review("admin", a.payment_id, "verified", null, true), "OVERRIDE_REASON_REQUIRED");
    const out = await review("admin", a.payment_id, "verified", "Paid the rest in cash", true);
    expect(out.registration_ids).toHaveLength(1);
    expect((await row("select review_note from public.payments where id = $1", [a.payment_id])).review_note).toBe("Paid the rest in cash");
  });

  it("underpaid keeps the form pending and its slot; the owner resubmits and the admin can verify", async () => {
    const ev = await mkEvent({ capacity: 3 });
    await asUser("jack"); const a = await submit("jack", ev, { x: "und_1" });
    await asUser("admin");
    await fails(db.query("select public.review_payment($1,'underpaid')", [a.payment_id]), "AMOUNT_DUE_REQUIRED");
    await review("admin", a.payment_id, "underpaid", "Transaction fee was deducted", false, 5);
    let p = await row("select * from public.payments where id = $1", [a.payment_id]);
    expect(p).toMatchObject({ status: "underpaid", review_note: "Transaction fee was deducted" });
    expect(Number(p.amount_due)).toBe(5);
    expect((await row("select status from public.registrations where id = $1", [a.registration_id])).status).toBe("pending_verification");
    const oldRef = p.reference_number, oldReceipt = p.receipt_path;

    await asUser("kim");   // someone else cannot resubmit it
    await fails(db.query("select public.resubmit_payment($1,'x y',105,'9990001112223',$2)", [a.payment_id, rcpt("kim")]), "INVALID_PAYMENT");
    await asUser("jack");
    // only the missing 5 is needed (not the full fee again), and it is added to what was paid before
    await fails(db.query("select public.resubmit_payment($1,'Juan D.',4.99,'9990001112223',$2)", [a.payment_id, rcpt("jack")]), "AMOUNT_TOO_LOW");
    await db.query("select public.resubmit_payment($1,'Juan D.',5,'9990001112223',$2)", [a.payment_id, rcpt("jack")]);
    p = await row("select * from public.payments where id = $1", [a.payment_id]);
    expect(p).toMatchObject({ status: "pending", reference_number: "9990001112223", amount_due: null, review_note: null, resubmission_count: 1 });
    expect(Number(p.amount_paid)).toBe(105);                    // 100 paid before + 5 now
    expect(p.amount_history.map(Number)).toEqual([100]);        // the earlier total is kept for the admin
    expect(p.reference_history).toEqual([oldRef]);
    expect(p.receipt_history).toEqual([oldReceipt]);
    await review("admin", a.payment_id, "verified");
  });

  it("rejecting requires a reason, releases the slot, and the owner can resubmit while a slot is free", async () => {
    const ev = await mkEvent({ capacity: 1 });
    await asUser("kim"); const a = await submit("kim", ev, { x: "rej_1" });
    await asUser("admin");
    await fails(db.query("select public.review_payment($1,'rejected')", [a.payment_id]), "REASON_REQUIRED");
    await review("admin", a.payment_id, "rejected", "Reference number does not match");
    expect((await row("select status from public.registrations where id = $1", [a.registration_id])).status).toBe("rejected");

    await asUser("lee"); const taken = await submit("lee", ev, { x: "rej_2" });   // someone else takes the freed slot
    await asUser("kim");
    await fails(db.query("select public.resubmit_payment($1,'Juan D.',100,'8880001112223',$2)", [a.payment_id, rcpt("kim")]), "SOLD_OUT");
    await asUser("admin");
    await review("admin", taken.payment_id, "rejected", "Fake receipt");
    await asUser("kim");
    await db.query("select public.resubmit_payment($1,'Juan D.',100,'8880001112223',$2)", [a.payment_id, rcpt("kim")]);
    expect((await row("select status from public.registrations where id = $1", [a.registration_id])).status).toBe("pending_verification");
    expect((await row("select status from public.payments where id = $1", [a.payment_id])).status).toBe("pending");
  });
});

describe("free events", () => {
  it("need no payment: the form is confirmed with a ticket straight away", async () => {
    const ev = await mkEvent({ fee: 0 });
    await asUser("max");
    const r = await submit("max", ev, { x: "free_1", sender: null, amount: null, ref: null, receipt: null });
    expect(r.status).toBe("confirmed");
    expect(r.ticket_number).toMatch(/^T\d{3}-\d{6}$/);
    expect(r.payment_id).toBeNull();
  });
});

describe("check-in only accepts confirmed tickets", () => {
  it("pending forms have no ticket and cannot be checked in; confirmed ones can; duplicates and cancelled are flagged", async () => {
    const ev = await mkEvent();
    await asUser("ned"); const a = await submit("ned", ev, { x: "chk_1" });
    await asUser("admin");
    expect((await db.query("select public.check_in_attendee('T999-000000') as r")).rows[0].r).toMatchObject({ result: "invalid", reason: "not_found" });
    await fails(db.query("select * from public.mark_attendance($1, true)", [a.registration_id]), "NOT_FOUND");
    const out = await review("admin", a.payment_id, "verified");
    const ticket = out.ticket_numbers[0];
    await asUser("admin");
    expect((await db.query("select public.check_in_attendee($1, true, true) as r", [ticket.toLowerCase()])).rows[0].r).toMatchObject({ result: "success", name: "Juan Dela Cruz", kit_claimed: true });
    expect((await db.query("select public.check_in_attendee($1) as r", [ticket])).rows[0].r).toMatchObject({ result: "duplicate" });
    await asSuper(); await db.query("update public.registrations set status = 'cancelled' where id = $1", [a.registration_id]);
    await asUser("admin");
    expect((await db.query("select public.check_in_attendee($1) as r", [ticket])).rows[0].r).toMatchObject({ result: "invalid", reason: "cancelled" });
    await asUser("alice");
    await fails(db.query("select public.check_in_attendee($1)", [ticket]), "FORBIDDEN");
  });
});

describe("row level security", () => {
  it("attendees see only their own registrations and payments, and cannot write to either", async () => {
    const ev = await mkEvent();
    await asUser("alice"); const a = await submit("alice", ev, { x: "rls_a" });
    await asUser("bob");   const b = await submit("bob", ev, { x: "rls_b" });
    await asUser("alice");
    expect((await db.query("select id from public.payments")).rows.map((r) => r.id)).toContain(a.payment_id);
    expect((await db.query("select id from public.payments")).rows.map((r) => r.id)).not.toContain(b.payment_id);
    expect((await db.query("select id from public.registrations where event_id = $1", [ev])).rows).toHaveLength(1);
    await expect(db.exec(`insert into public.payments (event_id, user_id, sender_name, amount_paid, reference_number) values ('${ev}', '${ids.alice}', 'x', 1, '12345678')`)).rejects.toThrow(/row-level security/);
    await db.exec("update public.payments set status = 'verified', amount_paid = 99999");                       // no update policy: 0 rows
    await db.exec("update public.registrations set status = 'confirmed', ticket_number = 'HACK-1'");
    await asSuper();
    expect((await db.query("select status from public.payments where id = $1", [a.payment_id])).rows[0].status).toBe("pending");
    expect((await db.query("select status, ticket_number from public.registrations where id = $1", [a.registration_id])).rows[0]).toEqual({ status: "pending_verification", ticket_number: null });
    await asUser(null);
    expect((await db.query("select * from public.payments")).rows).toHaveLength(0);
    expect((await db.query("select * from public.registrations")).rows).toHaveLength(0);
    await asUser("admin");
    expect((await db.query("select id from public.payments where event_id = $1", [ev])).rows).toHaveLength(2);
  });
  it("events and image slots are public to read, admin-only to write", async () => {
    await asUser(null);
    expect((await db.query("select id from public.events")).rows.length).toBeGreaterThan(1);
    expect((await db.query("select * from public.event_images")).rows.length).toBeGreaterThan(0);
    await asUser("alice");
    await expect(db.exec(`insert into public.event_images (event_id, slot, storage_path) select id, 'poster', 'x/p.png' from public.events limit 1`)).rejects.toThrow(/row-level security/);
    await asUser("admin");
    await db.exec(`insert into public.event_images (event_id, slot, storage_path) select id, 'poster', 'x/p.png' from public.events limit 1`);
    await expect(db.exec(`insert into public.event_images (event_id, slot) select id, 'poster' from public.events limit 1`)).rejects.toThrow();   // needs a source
  });
  it("keeps templates, email logs and attendance logs admin-only", async () => {
    for (const who of ["alice", null]) {
      await asUser(who);
      for (const t of ["email_templates", "email_logs", "attendance_logs", "registration_changes"]) expect((await db.query(`select * from public.${t}`)).rows.length, `${who} reads ${t}`).toBe(0);
    }
    await asUser("admin");
    expect((await db.query("select * from public.email_templates")).rows.length).toBeGreaterThan(4);
  });
});

describe("storage policies", () => {
  const put = (bucket, name) => db.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
  it("people upload receipts only into their own folder and read only their own files; admins read all", async () => {
    await asUser("alice");
    await put("payment-receipts", `${ids.alice}/${randomUUID()}.jpg`);
    await expect(put("payment-receipts", `${ids.bob}/${randomUUID()}.jpg`)).rejects.toThrow(/row-level security/);
    await expect(put("payment-receipts", `loose-${randomUUID()}.jpg`)).rejects.toThrow(/row-level security/);
    expect((await db.query("select name from storage.objects where bucket_id = 'payment-receipts'")).rows).toHaveLength(1);
    await asUser("bob");
    await put("payment-receipts", `${ids.bob}/${randomUUID()}.png`);
    expect((await db.query("select name from storage.objects where bucket_id = 'payment-receipts'")).rows.every((r) => r.name.startsWith(ids.bob))).toBe(true);
    await asUser(null);
    expect((await db.query("select name from storage.objects where bucket_id = 'payment-receipts'")).rows).toHaveLength(0);
    await asUser("admin");
    expect((await db.query("select name from storage.objects where bucket_id = 'payment-receipts'")).rows.length).toBeGreaterThanOrEqual(2);
  });
  it("only admins can delete receipts, and uploads are rate limited to 20 per hour", async () => {
    await asUser("carol");
    await put("payment-receipts", `${ids.carol}/${randomUUID()}.jpg`);
    await db.exec(`delete from storage.objects where bucket_id = 'payment-receipts' and name like '${ids.carol}/%'`);   // 0 rows: no policy
    expect((await db.query(`select count(*) from storage.objects where name like '${ids.carol}/%'`)).rows[0].count).toBe(1);
    for (let i = 0; i < 19; i++) await put("payment-receipts", `${ids.carol}/${randomUUID()}.jpg`);
    await expect(put("payment-receipts", `${ids.carol}/${randomUUID()}.jpg`)).rejects.toThrow(/row-level security/);
  });
  it("event media: anyone can read, only admins can upload", async () => {
    await asUser("admin"); await put("event-media", "e1/poster-1.png");
    await asUser("alice"); await expect(put("event-media", "e1/evil.png")).rejects.toThrow(/row-level security/);
    await asUser(null); expect((await db.query("select name from storage.objects where bucket_id = 'event-media'")).rows).toHaveLength(1);
  });
  it("the buckets are configured: receipts private, 10 MB, no executables", async () => {
    await asSuper();
    const b = Object.fromEntries((await db.query("select * from storage.buckets")).rows.map((r) => [r.id, r]));
    expect(b["payment-receipts"]).toMatchObject({ public: false, file_size_limit: 10485760 });
    expect(b["payment-receipts"].allowed_mime_types.sort()).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    expect(b["event-media"]).toMatchObject({ public: true, file_size_limit: 10485760 });
    expect(b["event-media"].allowed_mime_types).not.toContain("application/pdf");
  });
});

/* ======================================================================= kits, quantity and amount per kit */
const mkKit = async (ev, { name = "Standard kit", price = 100, max = 5, active = true, description = null } = {}) => {
  await asSuper();
  return (await db.query("insert into public.event_kits (event_id, name, description, unit_price, max_per_order, active) values ($1,$2,$3,$4,$5,$6) returning id", [ev, name, description, price, max, active])).rows[0].id;
};
const regRow = async (id) => row("select kit_id, kit_name, kit_quantity, kit_unit_price, total_amount, status from public.registrations where id = $1", [id]);

describe("kits: choosing a kit, a quantity, and paying quantity x price", () => {
  it("the amount to pay is quantity x the kit's price, worked out by the database", async () => {
    const ev = await mkEvent({ fee: 0 });                 // the flat fee is ignored once kits exist
    const standard = await mkKit(ev, { name: "Standard kit", price: 100, max: 5, description: "Cupsleeve + card" });
    const deluxe = await mkKit(ev, { name: "Deluxe kit", price: 250, max: 2 });
    await asUser("alice");
    const a = await submit("alice", ev, { x: "kit_a", kit: standard, qty: 3, amount: 300 });
    expect(a.status).toBe("pending_verification");
    expect(await regRow(a.registration_id)).toMatchObject({ kit_id: standard, kit_name: "Standard kit", kit_quantity: 3, status: "pending_verification" });
    expect(Number((await regRow(a.registration_id)).kit_unit_price)).toBe(100);
    expect(Number((await regRow(a.registration_id)).total_amount)).toBe(300);
    expect(a).toMatchObject({ kit_name: "Standard kit", kit_quantity: 3 }); expect(Number(a.total_amount)).toBe(300);
    await asUser("bob");
    const b = await submit("bob", ev, { x: "kit_b", kit: deluxe, qty: 2, amount: 500.5 });   // paying more than needed is allowed
    expect(Number((await regRow(b.registration_id)).total_amount)).toBe(500);
  });

  it("refuses an amount below quantity x price, a missing, foreign, switched-off or unknown kit, and a bad quantity", async () => {
    const ev = await mkEvent({ fee: 0 }), other = await mkEvent({ fee: 0 });
    const kit = await mkKit(ev, { price: 100, max: 3 });
    const foreign = await mkKit(other), off = await mkKit(ev, { name: "Retired kit", active: false });
    await asUser("carol");
    await fails(submit("carol", ev, { kit, qty: 2, amount: 199.99 }), "AMOUNT_TOO_LOW");       // 2 x 100 needs 200
    await fails(submit("carol", ev, { kit: null, qty: 1 }), "INVALID_KIT");                      // an event with kits needs a choice
    await fails(submit("carol", ev, { kit: foreign, qty: 1 }), "INVALID_KIT");                   // a kit of another event
    await fails(submit("carol", ev, { kit: off, qty: 1 }), "INVALID_KIT");                       // switched off
    await fails(submit("carol", ev, { kit: "00000000-0000-0000-0000-000000000000", qty: 1 }), "INVALID_KIT");
    await fails(submit("carol", ev, { kit, qty: 0 }), "INVALID_QUANTITY");
    await fails(submit("carol", ev, { kit, qty: -2 }), "INVALID_QUANTITY");
    await fails(submit("carol", ev, { kit, qty: 4 }), "INVALID_QUANTITY");                       // above max_per_order (3)
    await submit("carol", ev, { kit, qty: 3, amount: 300 });                                      // exactly the max is fine
  });

  it("what was ordered is kept on the registration: later price changes or a deleted kit never rewrite it", async () => {
    const ev = await mkEvent({ fee: 0 });
    const kit = await mkKit(ev, { name: "Standard kit", price: 100 });
    await asUser("dave"); const a = await submit("dave", ev, { x: "snap_a", kit, qty: 2, amount: 200 });
    await asSuper();
    await db.query("update public.event_kits set unit_price = 400, name = 'Premium kit' where id = $1", [kit]);
    expect(Number((await regRow(a.registration_id)).total_amount)).toBe(200);                     // unchanged
    // the admin can still verify it: the expected amount is the 200 that was ordered, not the new price
    const out = await review("admin", a.payment_id, "verified");
    expect(out.registration_ids).toEqual([a.registration_id]);
    await asSuper(); await db.query("delete from public.event_kits where id = $1", [kit]);
    expect(await regRow(a.registration_id)).toMatchObject({ kit_id: null, kit_name: "Standard kit", kit_quantity: 2 });
    expect(Number((await regRow(a.registration_id)).kit_unit_price)).toBe(100);
  });

  it("a shared payment is used up by balance: forms of different kits and quantities can share one transfer", async () => {
    const ev = await mkEvent({ fee: 0 });
    const a = await mkKit(ev, { name: "A", price: 100 }), b = await mkKit(ev, { name: "B", price: 250 });
    await asUser("erin");
    const first = await submit("erin", ev, { x: "bal_1", kit: a, qty: 1, amount: 350 });         // 350 paid, 100 used
    const second = await submit("erin", ev, { x: "bal_2", kit: b, qty: 1, payment_id: first.payment_id });   // 250 used, 0 left
    expect(second.payment_id).toBe(first.payment_id);
    await fails(submit("erin", ev, { x: "bal_3", kit: a, qty: 1, payment_id: first.payment_id }), "PAYMENT_BALANCE_TOO_LOW");
    await asUser("frank");
    const p = await submit("frank", ev, { x: "bal_4", kit: a, qty: 2, amount: 300 });            // 300 paid, 200 used
    await fails(submit("frank", ev, { x: "bal_5", kit: b, qty: 1, payment_id: p.payment_id }), "PAYMENT_BALANCE_TOO_LOW");   // 250 > 100 left
    await submit("frank", ev, { x: "bal_6", kit: a, qty: 1, payment_id: p.payment_id });          // 100 <= 100 left
    // verifying counts both forms: expected 300 = paid 300
    const out = await review("admin", p.payment_id, "verified");
    expect(out.registration_ids).toHaveLength(2);
  });

  it("a verified payment with balance left confirms a later kit order straight away", async () => {
    const ev = await mkEvent({ fee: 0 });
    const kit = await mkKit(ev, { price: 100 });
    await asUser("gina"); const a = await submit("gina", ev, { x: "ver_x1", kit, qty: 1, amount: 300 });
    await review("admin", a.payment_id, "verified");
    await asUser("gina");
    const b = await submit("gina", ev, { x: "ver_x2", kit, qty: 2, payment_id: a.payment_id });   // 200 of the 200 left
    expect(b.status).toBe("confirmed"); expect(b.ticket_number).toMatch(/^T\d{3}-\d{6}$/);
  });

  it("an underpaid payment is topped up with only the missing amount; a rejected one needs a full payment again", async () => {
    const ev = await mkEvent({ fee: 0 });
    const kit = await mkKit(ev, { price: 100 });
    // underpaid: 2 x 100 = 200 was sent, 5 is missing (the bank took a fee)
    await asUser("hank"); const a = await submit("hank", ev, { x: "res_k", kit, qty: 2, amount: 200 });
    await review("admin", a.payment_id, "underpaid", "Fee deducted", false, 5);
    await asUser("hank");
    await fails(db.query("select public.resubmit_payment($1,'Juan D.',4,'7770001112223',$2)", [a.payment_id, rcpt("hank")]), "AMOUNT_TOO_LOW");
    await db.query("select public.resubmit_payment($1,'Juan D.',5,'7770001112223',$2)", [a.payment_id, rcpt("hank")]);
    let p = await row("select * from public.payments where id = $1", [a.payment_id]);
    expect(Number(p.amount_paid)).toBe(205); expect(p.status).toBe("pending");
    await review("admin", a.payment_id, "verified");            // 205 covers the 200 the two kits cost

    // rejected: the slot was released, so a full payment for the forms is needed again and replaces the old amount
    const ev2 = await mkEvent({ fee: 0 }), kit2 = await mkKit(ev2, { price: 100 });
    await asUser("ivy"); const b = await submit("ivy", ev2, { x: "res_r", kit: kit2, qty: 2, amount: 200 });
    await review("admin", b.payment_id, "rejected", "Receipt unreadable");
    await asUser("ivy");
    await fails(db.query("select public.resubmit_payment($1,'Ivy R.',150,'7770001119999',$2)", [b.payment_id, rcpt("ivy")]), "AMOUNT_TOO_LOW");
    await db.query("select public.resubmit_payment($1,'Ivy R.',200,'7770001119999',$2)", [b.payment_id, rcpt("ivy")]);
    p = await row("select * from public.payments where id = $1", [b.payment_id]);
    expect(Number(p.amount_paid)).toBe(200);                    // replaced, not added
  });

  it("events without kit options keep the single flat fee and refuse a quantity or kit", async () => {
    const ev = await mkEvent({ fee: 100 }), anyKit = await mkKit(await mkEvent());
    await asUser("ivy");
    await fails(submit("ivy", ev, { qty: 2, amount: 200 }), "INVALID_QUANTITY");
    await fails(submit("ivy", ev, { kit: anyKit, qty: 1 }), "INVALID_QUANTITY");
    const r = await submit("ivy", ev, { x: "flat_1", amount: 100 });
    expect(await regRow(r.registration_id)).toMatchObject({ kit_name: "Registration", kit_quantity: 1 });
    expect(Number((await regRow(r.registration_id)).total_amount)).toBe(100);
  });

  it("the check-in result shows the kit and quantity, so it can be handed over at the door", async () => {
    const ev = await mkEvent({ fee: 0 });
    const kit = await mkKit(ev, { name: "Deluxe kit", price: 100 });
    await asUser("jack"); const a = await submit("jack", ev, { x: "door_1", kit, qty: 3, amount: 300 });
    const out = await review("admin", a.payment_id, "verified");
    await asUser("admin");
    expect((await db.query("select public.check_in_attendee($1) as r", [out.ticket_numbers[0]])).rows[0].r).toMatchObject({ result: "success", kit_name: "Deluxe kit", kit_quantity: 3 });
    expect((await db.query("select public.check_in_attendee($1) as r", [out.ticket_numbers[0]])).rows[0].r).toMatchObject({ result: "duplicate", kit_name: "Deluxe kit", kit_quantity: 3 });
  });

  it("visitors see only active kits; admins see all; attendees cannot change prices", async () => {
    const ev = await mkEvent({ fee: 0 });
    const live = await mkKit(ev, { name: "Live kit" }); await mkKit(ev, { name: "Hidden kit", active: false });
    await asUser(null);
    expect((await db.query("select name from public.event_kits where event_id = $1", [ev])).rows.map((r) => r.name)).toEqual(["Live kit"]);
    await asUser("kim");
    expect((await db.query("select name from public.event_kits where event_id = $1", [ev])).rows).toHaveLength(1);
    await db.exec(`update public.event_kits set unit_price = 1 where id = '${live}'`);               // no policy: 0 rows
    await expect(db.exec(`insert into public.event_kits (event_id, name, unit_price) values ('${ev}', 'Free kit', 1)`)).rejects.toThrow(/row-level security/);
    await asUser("admin");
    expect((await db.query("select name from public.event_kits where event_id = $1 order by name", [ev])).rows.map((r) => r.name)).toEqual(["Hidden kit", "Live kit"]);
    await db.exec(`update public.event_kits set unit_price = 120 where id = '${live}'`);
    await asSuper();
    expect(Number((await db.query("select unit_price from public.event_kits where id = $1", [live])).rows[0].unit_price)).toBe(120);
    await expect(db.exec(`insert into public.event_kits (event_id, name, unit_price) values ('${ev}', 'Bad', 0)`)).rejects.toThrow();            // price must be above 0
    await expect(db.exec(`insert into public.event_kits (event_id, name, unit_price, max_per_order) values ('${ev}', 'Bad', 5, 0)`)).rejects.toThrow();   // max at least 1
  });

  it("seeds one kit for ODD PLATINUM at the reference price", async () => {
    await asSuper();
    const k = (await db.query("select k.* from public.event_kits k join public.events e on e.id = k.event_id where e.title = 'IVEMON: ODD PLATINUM Cupsleeve Event'")).rows;
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ name: "Event kit", max_per_order: 1, active: true });   // 006: one kit per form
    expect(Number(k[0].unit_price)).toBe(100);
    expect(k[0].description).toBe("(1) Cupsleeve, (1) Trading Card, (2) Mezastar Tags");
  });
});

describe("upgrading a database that already has registrations (migration 003 on existing data)", () => {
  it("keeps every existing registration: quantity 1 at the event's old fee", async () => {
    const old = new PGlite();
    await old.exec(STUBS); await old.exec(read("schema.sql")); await old.exec(read("002_registration_payments.sql"));
    const u = (await old.query("insert into auth.users (email) values ('old@example.com') returning id")).rows[0].id;
    const ev = (await old.query("insert into public.events (title, event_date, capacity, ticket_prefix, registration_fee) values ('Old', now() + interval '9 days', 10, 'OLD', 100) returning id")).rows[0].id;
    const free = (await old.query("insert into public.events (title, event_date, capacity, ticket_prefix, registration_fee) values ('OldFree', now() + interval '9 days', 10, 'OLDF', 0) returning id")).rows[0].id;
    for (const [e, x, st] of [[ev, "old_a", "confirmed"], [ev, "old_b", "pending_verification"], [ev, "old_c", "cancelled"], [free, "old_d", "confirmed"]]) {
      await old.query("insert into public.registrations (event_id, user_id, name, x_username, email, ticket_number, status) values ($1,$2,'Old Person',$3,'o@x.io',$4,$5)", [e, u, x, st === "pending_verification" ? null : "OLD-" + x, st]);
    }
    await old.exec(read("003_kits.sql"));
    const rows = (await old.query("select x_username, kit_name, kit_quantity, kit_unit_price, total_amount, status from public.registrations order by x_username")).rows;
    expect(rows.map((r) => [r.x_username, r.kit_name, r.kit_quantity, Number(r.total_amount), r.status])).toEqual([
      ["old_a", "Registration", 1, 100, "confirmed"], ["old_b", "Registration", 1, 100, "pending_verification"], ["old_c", "Registration", 1, 100, "cancelled"], ["old_d", null, 1, 0, "confirmed"],
    ]);
    expect(rows.every((r) => r.kit_unit_price !== undefined)).toBe(true);
    // the old 13-argument function is gone and the new one exists with the kit arguments
    const fn = (await old.query("select pronargs from pg_proc where proname = 'submit_registration'")).rows;
    expect(fn.map((f) => f.pronargs)).toEqual([15]);
  });
});

describe("004 change log", () => {
  it("records admin edits with who/what, redacts personal data, and cannot be written or read by others", async () => {
    const ev = await mkEvent();
    await asUser("admin");
    await db.query("update public.events set title = 'Renamed' where id = $1", [ev]);
    await asUser("alice");
    const r = await submit("alice", ev);
    await asSuper();
    await db.exec(`update public.registrations set name = 'Secret Name', kit_claimed = true where event_id = '${ev}'`);

    await asUser("admin");
    const ch = (await db.query("select * from public.change_log where event_id = $1 order by id", [ev])).rows;
    const ev1 = ch.find((c) => c.table_name === "events" && c.action === "update");
    expect(ev1.actor_email).toBe("admin@example.com");
    expect(ev1.changes.title.new).toBe("Renamed");
    const reg = ch.filter((c) => c.table_name === "registrations");
    expect(reg.some((c) => c.action === "insert")).toBe(true);
    const upd = reg.find((c) => c.action === "update");
    expect(upd.changes.name).toBe("[changed]");
    expect(upd.changes.kit_claimed.new).toBe("true");
    expect(JSON.stringify(ch.map((c) => [c.label, c.changes]))).not.toMatch(/Secret Name|alice@example\.com|09171234567/);
    expect(ch.some((c) => c.table_name === "payments" && c.action === "insert")).toBe(true);

    await asUser("alice");
    expect((await db.query("select * from public.change_log")).rows).toHaveLength(0);
    await fails(db.query("insert into public.change_log (table_name, action) values ('x','insert')"), /row-level security|permission/);
    await asUser("admin");
    await db.query("update public.change_log set label = 'x'");
    await db.query("delete from public.change_log");
    expect((await db.query("select count(*)::int as n from public.change_log")).rows[0].n).toBeGreaterThan(0);
    expect(r).toBeTruthy();
  });

  it("logs role changes but not sign-ups, and skips updates that only touch ignored columns", async () => {
    await asSuper();
    await db.exec(`update public.profiles set role = 'admin' where id = '${ids.bob}'`);
    await db.exec(`update public.profiles set role = 'attendee' where id = '${ids.bob}'`);
    const ev = await mkEvent();
    const before = (await db.query("select count(*)::int as n from public.change_log where event_id = $1", [ev])).rows[0].n;
    await db.exec(`update public.events set updated_at = now() + interval '1 second' where id = '${ev}'`).catch(() => {});
    const after = (await db.query("select count(*)::int as n from public.change_log where event_id = $1", [ev])).rows[0].n;
    expect(after).toBe(before);
    const roles = (await db.query("select action, changes from public.change_log where table_name = 'profiles' and row_id = $1", [ids.bob])).rows;
    expect(roles.length).toBe(2);
    expect(roles[0].changes.role.new).toBe("admin");
    expect((await db.query("select count(*)::int as n from public.change_log where table_name = 'profiles' and action = 'insert'")).rows[0].n).toBe(0);
  });
});

describe("005 underpayment email", () => {
  it("the underpaid email tells people to send only the remaining amount (new and existing events)", async () => {
    await asSuper();
    const d = (await db.query("select * from public.default_email_template('payment_underpaid')")).rows[0];
    for (const body of [d.html_body, d.text_body]) { expect(body).toContain("send only the remaining"); expect(body).toContain("{{Amount Due}}"); expect(body).not.toContain("resubmit your payment with the new receipt"); }
    const ev = await mkEvent();
    const t = (await db.query("select html_body, text_body from public.email_templates where event_id = $1 and kind = 'payment_underpaid'", [ev])).rows[0];
    expect(t.html_body).toContain("send only the remaining");
    expect(t.text_body).toContain("You do not need to pay the full amount again");
  });
});

describe("006 one kit per form", () => {
  it("new kits default to one per form and the database refuses a quantity above 1", async () => {
    await asSuper();
    const ev = await mkEvent();
    const kit = (await db.query("insert into public.event_kits (event_id, name, unit_price) values ($1,'Solo kit',100) returning id, max_per_order", [ev])).rows[0];
    expect(kit.max_per_order).toBe(1);
    await asUser("alice");
    await fails(submit("alice", ev, { x: "solo_a", kit: kit.id, qty: 2, amount: 200 }), "INVALID_QUANTITY");
    const ok = await submit("alice", ev, { x: "solo_a", kit: kit.id, qty: 1, amount: 100 });
    expect(await regRow(ok.registration_id)).toMatchObject({ kit_name: "Solo kit", kit_quantity: 1 });
  });
});

describe("007 free reference number", () => {
  it("accepts a reference exactly as the bank shows it (letters, hyphens, short or long), still refuses duplicates", async () => {
    await asSuper();
    const ev = await mkEvent();
    await asUser("alice");
    const a = await submit("alice", ev, { x: "ref_a", ref: "GC-2024-ab12" });
    const pay = (await db.query("select reference_number from public.payments where id = $1", [a.payment_id])).rows[0];
    expect(pay.reference_number).toBe("GC-2024-ab12");                                         // hyphens and letters are kept
    const b = await submit("alice", ev, { x: "ref_b", ref: "42" });                            // a short one is fine too
    expect(b.payment_id).toBeTruthy();
    await fails(submit("alice", ev, { x: "ref_c", ref: "GC-2024-ab12" }), "DUPLICATE_REFERENCE");
    await fails(submit("alice", ev, { x: "ref_d", ref: "GC-2024 -ab12" }), "DUPLICATE_REFERENCE");   // spaces are ignored when comparing
  });
});

describe("008 banner coming soon", () => {
  it("defaults to off, and only an admin can switch it on", async () => {
    await asSuper();
    const ev = await mkEvent();
    expect((await db.query("select banner_coming_soon from public.events where id = $1", [ev])).rows[0].banner_coming_soon).toBe(false);
    await asUser("alice");
    await db.query("update public.events set banner_coming_soon = true where id = $1", [ev]);
    expect((await db.query("select banner_coming_soon from public.events where id = $1", [ev])).rows[0].banner_coming_soon).toBe(false);   // RLS: no row was updated
    await asUser("admin");
    await db.query("update public.events set banner_coming_soon = true where id = $1", [ev]);
    expect((await db.query("select banner_coming_soon from public.events where id = $1", [ev])).rows[0].banner_coming_soon).toBe(true);
  });
});
