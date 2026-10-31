import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { buildValues, contactLinks, escapeHtml, htmlToText, renderEmail, sanitizeHtml } from "../supabase/functions/_shared/merge.ts";

describe("sanitizeHtml (admin-edited terms)", () => {
  it("keeps the formatting tags and safe links", () => {
    const out = sanitizeHtml('<p>Hi <strong>there</strong> <em>you</em></p><ol><li>One</li><li>Two <a href="https://x.com/TeenfreshPH">X</a></li></ol>');
    expect(out).toBe('<p>Hi <strong>there</strong> <em>you</em></p><ol><li>One</li><li>Two <a href="https://x.com/TeenfreshPH" rel="noopener noreferrer">X</a></li></ol>');
  });
  it("removes scripts (with their content), event handlers, styles, iframes and unknown tags", () => {
    const out = sanitizeHtml('<p onclick="alert(1)" style="x">a</p><script>alert(1)</script><iframe src="//evil"></iframe><img src=x onerror=alert(1)><div>b</div><style>p{}</style>');
    expect(out).toBe("<p>a</p>b");
    expect(out).not.toMatch(/script|alert|onerror|iframe|style|<img|<div/i);
  });
  it("blocks javascript:, data: and obfuscated URLs in links, keeps https and mailto", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "jav&#x61;script:alert(1)", "&#106;avascript:alert(1)", "data:text/html,x", " javascript:alert(1)", "//evil.com", "vbscript:x"]) {
      expect(sanitizeHtml(`<a href="${bad}">x</a>`), bad).toBe("<a>x</a>");
    }
    expect(sanitizeHtml('<a href="mailto:teenfreshph@gmail.com">m</a>')).toContain('href="mailto:teenfreshph@gmail.com"');
    expect(sanitizeHtml("<a href='https://a.com/?x=1&y=2'>m</a>")).toContain('href="https://a.com/?x=1&amp;y=2"');
  });
  it("escapes stray < > and bare &, keeps real entities, and balances unclosed tags", () => {
    expect(sanitizeHtml("1 < 2 & 3 > 2 &amp; ok")).toBe("1 &lt; 2 &amp; 3 &gt; 2 &amp; ok");
    expect(sanitizeHtml("<p><strong>open")).toBe("<p><strong>open</strong></p>");
    expect(sanitizeHtml("text</strong></p>")).toBe("text");
    expect(sanitizeHtml("<<script>b>")).not.toContain("<script");
  });
  it("adds inline styles for email clients when asked", () => {
    const out = sanitizeHtml("<p>a</p><ol><li>b</li></ol>", { email: true });
    expect(out).toContain('<p style="margin:0 0 12px 0;">');
    expect(out).toContain('<ol style="margin:0 0 12px 0;padding:0 0 0 18px;">');
  });
});

describe("htmlToText", () => {
  it("numbers ordered lists, bullets unordered ones, and decodes entities", () => {
    const t = htmlToText('<p>Intro &amp; more</p><ol><li>First <strong>bold</strong></li><li>Second</li></ol><ul><li>Dot</li></ul><p>See <a href="https://x.com/a">our X</a></p>');
    expect(t).toBe("Intro & more\n\n1. First bold\n2. Second\n\n- Dot\n\nSee our X (https://x.com/a)");
  });
});

const event = {
  id: "e1", title: "IVEMON: ODD PLATINUM Cupsleeve Event", subtitle: "Hosted by <Teenfresh>", event_date: "2026-10-04T06:00:00Z", venue: "Psicom", registration_fee: 100,
  terms_html: '<p>Please read.</p><ol><li>No <strong>REFUNDS</strong>.</li><li onclick="x()">Second</li></ol><script>alert(1)</script>',
  contact_links: [{ label: "Facebook", url: "https://www.facebook.com/TeenfreshPH" }, { label: "Gmail", url: "mailto:teenfreshph@gmail.com" }, { label: "Evil", url: "javascript:alert(1)" }, { label: "", url: "https://x.com" }],
};
const reg = { name: "Juan <b>D</b>", x_username: "@juan", ticket_number: "IVEMONOP-000007" };

describe("merge fields from the event record", () => {
  it("terms come from terms_html, sanitized, in both versions", () => {
    const html = buildValues({ reg, event }, "html").Terms, text = buildValues({ reg, event }, "text").Terms;
    expect(html).toContain("border-left:3px solid #dadce0");
    expect(html).toContain("<strong>REFUNDS</strong>");
    expect(html).not.toMatch(/script|onclick|alert/);
    expect(text).toContain("    1. No REFUNDS.");
    expect(text).toContain("    2. Second");
  });
  it("contact links are filtered to http(s)/mailto and escaped", () => {
    expect(contactLinks(event.contact_links).map((l) => l.label)).toEqual(["Facebook", "Gmail"]);
    const html = buildValues({ reg, event }, "html")["Contact Links"];
    expect(html).toContain('Facebook: <a href="https://www.facebook.com/TeenfreshPH"');
    expect(html).toContain(">teenfreshph@gmail.com</a>");
    expect(html).not.toMatch(/javascript|Evil/);
    expect(buildValues({ reg, event }, "text")["Contact Links"]).toBe("Facebook: https://www.facebook.com/TeenfreshPH\nGmail: teenfreshph@gmail.com");
  });
  it("the banner is an absolute, escaped <img>, or nothing when there is no image", () => {
    const withImg = buildValues({ reg, event, site: "https://app.example.com", bannerUrl: "/storage/b.png", bannerAlt: 'A "banner"' }, "html").Banner;
    expect(withImg).toContain('src="https://app.example.com/storage/b.png"');
    expect(withImg).toContain('alt="A &quot;banner&quot;"');
    expect(buildValues({ reg, event }, "html").Banner).toBe("");
    expect(buildValues({ reg, event, bannerUrl: "https://x.test/b.png" }, "text").Banner).toBe("");
  });
  it("payment fields are formatted and escaped", () => {
    const v = buildValues({ reg, event, extra: { reason: "<b>bad</b>", amount_paid: 95, amount_due: "5", reference_number: "123" } }, "html");
    expect(v["Amount Paid"]).toBe("95.00");
    expect(v["Amount Due"]).toBe("5.00");
    expect(v["Registration Fee"]).toBe("100.00");
    expect(v["Event Subtitle"]).toBe("Hosted by <Teenfresh>"); // escaped later by renderTemplate
  });
});

// The real default templates, straight from the migration
describe("default email templates (from the migration)", () => {
  let tpl;
  beforeAll(async () => {
    const db = new PGlite();
    await db.exec(`create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$; create role anon nologin; create role authenticated nologin; create publication supabase_realtime;
      create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
      create function storage.foldername(name text) returns text[] language sql as $$ select '{}'::text[] $$;`);
    for (const f of ["schema.sql", "002_registration_payments.sql"]) await db.exec(fs.readFileSync(new URL("../supabase/migrations/" + f, import.meta.url), "utf8"));
    tpl = Object.fromEntries((await db.query("select * from public.default_email_template('confirmation') union all select * from public.default_email_template('payment_underpaid')")).rows.map((r, i) => [i ? "underpaid" : "confirmation", r]));
    tpl.rejected = (await db.query("select * from public.default_email_template('payment_rejected')")).rows[0];
    tpl.ack = (await db.query("select * from public.default_email_template('acknowledgment')")).rows[0];
  });

  const src = { reg, event, site: "https://app.example.com", bannerUrl: "https://app.example.com/storage/email.png", bannerAlt: "ODD PLATINUM", extra: { reason: "Reference does not match", amount_paid: 95, amount_due: 5, reference_number: "1234567890123" } };

  it("confirmation: exact layout, with the event record supplying title, banner, terms and contact links", () => {
    const m = renderEmail(tpl.confirmation, src);
    expect(m.subject).toBe("Confirmation email - IVEMON: ODD PLATINUM Cupsleeve Event");
    expect(m.html).toContain("Thank you for your interest in joining IVEMON: ODD PLATINUM Cupsleeve Event! This will serve as your confirmation email, to summarize:");
    expect(m.html).toContain("Name: Juan &lt;b&gt;D&lt;/b&gt;<br>Twitter Username: @juan<br>Ticket Number: IVEMONOP-000007");
    expect(m.html).toContain('<img src="https://app.example.com/storage/email.png"');
    expect(m.html).toContain("border-left:3px solid #dadce0");
    expect(m.html).toContain("<strong>REFUNDS</strong>");
    expect(m.html).toContain("Facebook: <a href=");
    expect(m.html).toContain("Best Regards,");
    expect(m.html).toContain('alt="Teenfresh"');
    expect(m.text).toContain("Ticket Number: IVEMONOP-000007");
    expect(m.text).toContain("    1. No REFUNDS.");
    expect(m.text).toContain("Gmail: teenfreshph@gmail.com");
    expect(m.html).not.toMatch(/<style|<script|class=/i);
    for (const bad of ["Summarize this email", "Yes, I confirm", "Confirmed!", "Yes, I will be attending"]) expect(m.html + m.text).not.toContain(bad);
  });
  it("links use the accessible link colour and no email contains a leftover merge marker", () => {
    for (const t of Object.values(tpl)) {
      const m = renderEmail(t, src);
      expect(m.html + m.text + m.subject).not.toMatch(/\{\{/);
      expect(m.html).not.toContain("#1155cc");
      for (const c of m.html.matchAll(/<a [^>]*color:(#[0-9a-f]{6})/gi)) expect(c[1].toLowerCase()).toBe("#1c5a85");
    }
  });
  it("underpaid, rejected and acknowledgment templates carry the right merge values", () => {
    const u = renderEmail(tpl.underpaid, src);
    expect(u.html).toContain("Remaining amount due: PHP 5.00");
    expect(u.html).toContain("reference number 1234567890123, PHP 95.00");
    expect(u.subject).toBe("Action needed: payment incomplete - IVEMON: ODD PLATINUM Cupsleeve Event");
    const r = renderEmail(tpl.rejected, src);
    expect(r.html).toContain("<strong>Reason:</strong> Reference does not match");
    expect(r.text).toContain("Reason: Reference does not match");
    expect(r.subject).toBe("Payment not verified - IVEMON: ODD PLATINUM Cupsleeve Event");
    const a = renderEmail(tpl.ack, src);
    expect(a.html).toContain("within 48 to 72 hours");
  });
  it("a reason with HTML cannot inject markup", () => {
    const m = renderEmail(tpl.rejected, { ...src, extra: { ...src.extra, reason: '<img src=x onerror=alert(1)>' } });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("no banner image means no broken <img> at the top", () => {
    const m = renderEmail(tpl.confirmation, { ...src, bannerUrl: null });
    expect(m.html).not.toMatch(/<img src=""/);
  });
  it("escapeHtml still escapes", () => { expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;"); });
});
