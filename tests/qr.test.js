import { describe, expect, it } from "vitest";
import qrcode from "qrcode-generator";
import jsQR from "jsqr";
import { renderQr } from "../supabase/functions/_shared/qrcore.ts";
import { buildValues, renderEmail, withQrBlock, SAMPLE_REG } from "../supabase/functions/_shared/merge.ts";

const modulesFor = (text) => {
  const q = qrcode(0, "H"); q.addData(text, "Byte"); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
};
const decode = ({ size, data }) => jsQR(data, size, size)?.data;

describe("emailed QR code with the Teenfresh logo", () => {
  it.each(["IVEMON-000001", "T001-000123", "ODDPLATINUM-004567", "A-1", "TEENFRESH-EVENTS-PREFIX-LONGER-000001"])("still scans with the logo in the middle: %s", (t) => {
    expect(decode(renderQr(modulesFor(t)))).toBe(t);
  });

  it("draws the logo: the middle is coloured, not just black and white", () => {
    const { size, data } = renderQr(modulesFor("IVEMON-000001"));
    let coloured = 0;
    for (let y = size * 0.4; y < size * 0.6; y++) for (let x = size * 0.3; x < size * 0.7; x++) {
      const o = (Math.floor(y) * size + Math.floor(x)) * 4;
      const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
      if (Math.abs(r - b) > 40 || Math.abs(r - g) > 40) coloured++;  // pink / blue / cream pixels
    }
    expect(coloured).toBeGreaterThan(300);
    const without = renderQr(modulesFor("IVEMON-000001"), { withLogo: false });
    expect(without.data.length).toBe(data.length);
    expect(Buffer.compare(Buffer.from(without.data), Buffer.from(data))).not.toBe(0);
  });

  it("keeps a quiet zone and is well under the correction limit (logo plate < 12% of the symbol)", () => {
    const m = modulesFor("IVEMON-000001");
    const { size, data } = renderQr(m);
    for (let i = 0; i < size; i++) expect(data[(i) * 4]).toBe(255);          // top row is white (quiet zone)
    const n = m.length, scale = Math.floor(480 / (n + 8));
    const plateW = Math.round(n * scale * 0.4) + 2 * scale, plateH = Math.round(Math.round(n * scale * 0.4) * 43 / 200) + 2 * scale;
    expect((plateW * plateH) / (n * scale) ** 2).toBeLessThan(0.12);
  });
});

describe("QR block in the email", () => {
  const reg = { ...SAMPLE_REG, ticket_number: "IVEMON-000001" };
  const event = { title: "E" };
  const URL_ = "https://x.supabase.co/storage/v1/object/public/event-media/qr/abc.png";

  it("{{QR Code}} becomes an image with the ticket number as its alternative text", () => {
    const html = renderEmail({ subject: "s", html_body: "A {{QR Code}} B", text_body: "t" }, { reg, event, qrUrl: URL_ }).html;
    expect(html).toContain(`<img src="${URL_}"`);
    expect(html).toContain('alt="Ticket QR code for IVEMON-000001"');
    expect(html).toContain("Show this at the entrance");
  });
  it("is empty in the plain-text version and when there is no QR image", () => {
    const t = renderEmail({ subject: "s", html_body: "{{QR Code}}", text_body: "[{{QR Code}}]" }, { reg, event, qrUrl: URL_ });
    expect(t.text).toBe("[]");
    expect(renderEmail({ subject: "s", html_body: "[{{QR Code}}]", text_body: "t" }, { reg, event }).html).toBe("[]");
  });
  it("older confirmation templates get the QR block before the Terms, once", () => {
    expect(withQrBlock("<p>x</p>{{Terms}}<p>y</p>")).toBe("<p>x</p>{{QR Code}}\n{{Terms}}<p>y</p>");
    expect(withQrBlock("<p>x</p>")).toBe("<p>x</p>\n{{QR Code}}");
    expect(withQrBlock("{{ QR Code }}{{Terms}}")).toBe("{{ QR Code }}{{Terms}}");           // already placed by the admin
    const html = renderEmail({ subject: "s", html_body: "<p>x</p>{{Terms}}", text_body: "t" }, { reg, event, qrUrl: URL_, ensureQr: true }).html;
    expect(html.indexOf("<img src=\"" + URL_)).toBeGreaterThan(-1);
    expect(html.match(/<img src=/g)).toHaveLength(1);
  });
  it("is not added to other emails, or when the QR image could not be made", () => {
    expect(renderEmail({ subject: "s", html_body: "<p>x</p>{{Terms}}", text_body: "t" }, { reg, event, qrUrl: URL_ }).html).not.toContain("<img");
    expect(renderEmail({ subject: "s", html_body: "<p>x</p>{{Terms}}", text_body: "t" }, { reg, event, ensureQr: true }).html).not.toContain("<img");
  });
  it("escapes the URL and the ticket number", () => {
    const v = buildValues({ reg: { ...reg, ticket_number: '"><script>' }, event, qrUrl: 'https://x/"onerror="y' }, "html");
    expect(v["QR Code"]).not.toMatch(/<script>|"onerror="/);
  });
});
