import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { readTokens } from "../scripts/contrast.js";
import { buildValues, escapeHtml, renderEmail, renderTemplate, termsHtml } from "../supabase/functions/_shared/merge.ts";

const SQL = fs.readFileSync(new URL("../supabase/migrations/schema.sql", import.meta.url), "utf8");
const between = (tag) => SQL.split(`$${tag}$`)[1];
const TEMPLATE = { subject: between("s"), html_body: between("html"), text_body: between("text") };
const ITEMS = [...SQL.matchAll(/\$t\$([\s\S]*?)\$t\$/g)].map((m) => m[1]);
const event = {
  title: "IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event", event_date: "2026-12-20T06:00:00Z", venue: "Cafe <One>",
  banner_url: "/banners/ivemon.png", terms_intro: ITEMS[0], terms_items: ITEMS.slice(1),
};

describe("renderTemplate", () => {
  it("fills known fields, blanks unknown ones, and ignores spacing/case in the marker", () => {
    expect(renderTemplate("Hi {{ name }}, {{Nope}}!", { Name: "Ana" }, "text")).toBe("Hi Ana, !");
  });
  it("HTML-escapes values and never re-expands markers inside a value", () => {
    const out = renderTemplate("<p>{{Name}}</p>", { Name: '<img src=x onerror=alert(1)> {{Ticket Number}}', "Ticket Number": "SECRET" }, "html");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("{{Ticket Number}}"); // left as text, not replaced by SECRET
    expect(out).not.toContain("SECRET");
  });
  it("escapeHtml handles quotes and ampersands", () => {
    expect(escapeHtml(`"A" & 'B'`)).toBe("&quot;A&quot; &amp; &#39;B&#39;");
  });
});

describe("the seeded confirmation email", () => {
  const reg = { name: "Juan <b>Dela Cruz</b>", x_username: "@juan_dc", ticket_number: "IVEMON-000123" };
  const mail = renderEmail(TEMPLATE, { reg, event, site: "https://app.example.com" });

  it("has the exact subject", () => {
    expect(mail.subject).toBe("Confirmation email - IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event");
  });
  it("merges name, X username (single @) and ticket number, escaped in HTML", () => {
    expect(mail.html).toContain("Name: Juan &lt;b&gt;Dela Cruz&lt;/b&gt;");
    expect(mail.html).toContain("Twitter Username: @juan_dc");
    expect(mail.html).not.toContain("@@");
    expect(mail.html).toContain("Ticket Number: IVEMON-000123");
    expect(mail.text).toContain("Name: Juan <b>Dela Cruz</b>"); // plain text is not HTML
    expect(mail.text).toContain("Ticket Number: IVEMON-000123");
  });
  it("contains the required wording and every term, in both versions", () => {
    const intro = "Thank you for your interest in joining IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event! This will serve as your confirmation email, to summarize:";
    expect(mail.text).toContain(intro);
    expect(mail.html).toContain(intro.replace("&", "&amp;"));
    expect(ITEMS).toHaveLength(7); // intro + 6 rules
    for (const t of ITEMS) { expect(mail.text).toContain(t); expect(mail.html).toContain(escapeHtml(t)); }
    expect(mail.text).toContain("Facebook: https://www.facebook.com/TeenfreshPH");
    expect(mail.text).toContain("X: https://x.com/TeenfreshPH");
    expect(mail.html).toContain("Best Regards,");
  });
  it("puts the terms in a left-bordered block and the images at absolute URLs", () => {
    expect(mail.html).toContain("border-left:3px solid #dadce0");
    expect(mail.html).toContain('src="https://app.example.com/banners/ivemon.png"');
    expect(mail.html).toContain('src="https://app.example.com/email/logo.png"');
    expect(mail.html).toContain('src="https://app.example.com/email/facebook.png"');
    expect(mail.html).toContain('src="https://app.example.com/email/x.png"');
    expect(mail.html).toContain("/TeenfreshPH</a>");
    expect(mail.html).toContain("@TeenfreshPH</a>");
  });
  it("is email-safe: inline CSS, no scripts, and no Gmail interface text", () => {
    expect(mail.html).not.toMatch(/<style|<script|<link|class=/i);
    for (const bad of ["Summarize this email", "Yes, I confirm", "Confirmed!", "Yes, I will be attending"]) {
      expect(mail.html).not.toContain(bad); expect(mail.text).not.toContain(bad);
    }
    expect(mail.html).toContain("max-width:800px");
    expect(mail.html).toContain("Arial");
  });
  it("email links use the accessible `link` token and have alt text on images", () => {
    const link = readTokens().link;
    expect(link).toBe("#1c5a85");
    const colours = [...mail.html.matchAll(/<a [^>]*color:(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
    expect(colours.length).toBeGreaterThanOrEqual(4);
    expect(new Set(colours)).toEqual(new Set([link]));
    expect(mail.html).not.toContain("#1155cc");
    for (const img of mail.html.match(/<img [^>]*>/g)) expect(img).toMatch(/\balt=/);
    expect(mail.html).toContain('alt="IVEMON: Brilliant Force &amp; Shining Eight"');
  });
  it("leaves unknown merge fields blank instead of crashing", () => {
    const m = renderEmail({ subject: "S {{Mystery}}", html_body: "<p>{{Mystery}}|{{Venue}}</p>", text_body: "{{Mystery}}|{{Venue}}" }, { reg, event });
    expect(m.html).toBe("<p>|Cafe &lt;One&gt;</p>");
    expect(m.text).toBe("|Cafe <One>");
    expect(m.subject).toBe("S");
  });
  it("formats the event date in Manila time", () => {
    expect(buildValues({ reg, event }, "text")["Event Date"]).toContain("2:00 PM");
  });
  it("escapes the terms block", () => {
    expect(termsHtml("a<b", ["x & y"])).toContain("a&lt;b");
    expect(termsHtml("a", ["x & y"])).toContain("x &amp; y");
  });
});
