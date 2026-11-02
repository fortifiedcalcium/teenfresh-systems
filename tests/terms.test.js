// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { htmlToText, textToHtml } from "../src/lib/terms.js";

describe("Terms: plain text becomes HTML once", () => {
  it("blank lines make paragraphs, single newlines make <br>", () => {
    expect(textToHtml("One\ntwo\n\nThree")).toBe("<p>One<br>\ntwo</p>\n<p>Three</p>");
    expect(textToHtml("  \n")).toBe("");
  });
  it("bullets and numbers become lists", () => {
    expect(textToHtml("Rules:\n1. Be sure\n2. No refunds")).toBe("<p>Rules:</p>\n<ol>\n<li>Be sure</li>\n<li>No refunds</li>\n</ol>");
    expect(textToHtml("- a\n* b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
  });
  it("bold, italic, underline and links", () => {
    expect(textToHtml("**NO** *REFUND* __now__")).toBe("<p><strong>NO</strong> <em>REFUND</em> <u>now</u></p>");
    expect(textToHtml("[FB](https://fb.com/x_y_z) and https://a.b/c_d_e.")).toBe('<p><a href="https://fb.com/x_y_z">FB</a> and <a href="https://a.b/c_d_e">https://a.b/c_d_e</a>.</p>');
  });
  it("escapes typed HTML and refuses javascript: links", () => {
    expect(textToHtml("<script>alert(1)</script> & \"q\"")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;</p>");
    expect(textToHtml("[x](javascript:alert(1))")).not.toContain("<a");
  });
  it("existing HTML opens as readable text and round-trips", () => {
    const html = '<p>Please read.</p><ol><li>Strictly <strong>NO CANCELLATION</strong>.</li><li>Be sure</li></ol>';
    const text = htmlToText(html);
    expect(text).toBe("Please read.\n\n1. Strictly **NO CANCELLATION**.\n2. Be sure");
    expect(textToHtml(text)).toContain("<strong>NO CANCELLATION</strong>");
    expect(htmlToText("")).toBe("");
    expect(htmlToText("plain")).toBe("plain");
  });
});
