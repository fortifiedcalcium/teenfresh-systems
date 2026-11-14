import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, KIND_STATUS, ORDER_KINDS, fillOrderFields, renderOrderEmail, unknownOrderFields } from "../supabase/functions/_shared/orderEmail.ts";

const order = { id: "o1", order_number: "TF-000007", name: "Juan <b>Dela</b> Cruz", email: "juan@example.com", phone: "+639171234567", address: "12 Rizal St.", city: "Makati", postal_code: "1210", subtotal_php: "1482.48", shipping_php: "150.00", total_php: "1632.48" };
const items = [{ artist: "Marv", title: "ÖRBITAL & more", unit_price_php: "741.24", quantity: 2 }];

describe("renderOrderEmail", () => {
  it("has a subject, a heading and the order number for every kind", () => {
    for (const k of ORDER_KINDS) {
      const m = renderOrderEmail(k, order, items, "https://shop.example");
      expect(m.subject).toContain("TF-000007");
      expect(m.html).toContain("Order TF-000007");
      if (k === "order_shipping_due") expect(m.text).toContain("Shipping fee to pay");     // this one shows only the fee
      else expect(m.text).toContain("Total paid (GCash): PHP 1,632.48");
    }
    expect(Object.keys(KIND_STATUS).sort()).toEqual([...ORDER_KINDS].sort());
  });
  it("lists the items, the totals and the delivery address, and links to the order", () => {
    const m = renderOrderEmail("order_paid", order, items, "https://shop.example/");
    expect(m.text).toContain("PHP 741.24 x 2");
    expect(m.text).toContain("Items: PHP 1,482.48");
    expect(m.text).toContain("12 Rizal St.");
    expect(m.html).toContain('href="https://shop.example/orders/o1"');
    expect(m.text).toContain("https://shop.example/orders/o1");
  });
  it("escapes what shoppers typed", () => {
    const m = renderOrderEmail("order_paid", order, items, "");
    expect(m.html).not.toContain("<b>Dela</b>");
    expect(m.html).toContain("Juan &lt;b&gt;Dela&lt;/b&gt; Cruz");
    expect(m.html).toContain("ÖRBITAL &amp; more");
    expect(m.html).not.toContain("View your order");   // no site address configured, no link
  });
  it("says Free when there is no shipping fee", () => {
    expect(renderOrderEmail("order_shipped", { ...order, shipping_php: "0" }, items, "").text).toContain("Shipping: Free");
  });
});

describe("editable wording", () => {
  it("uses the admin's text, fills the placeholders and keeps the order details", () => {
    const tpl = { subject: "Order {{order number}} is in, {{Name}}!", heading: "Salamat!", body: "Hello {{Name}}.\n\nYour total is {{Total}}.\nSee you soon." };
    const m = renderOrderEmail("order_paid", order, items, "", tpl);
    expect(m.subject).toBe("Order TF-000007 is in, Juan <b>Dela</b> Cruz!");
    expect(m.text).toContain("Salamat!");
    expect(m.text).toContain("Your total is PHP 1,632.48.");
    expect(m.html).toContain("<p style=\"margin:0 0 16px 0;\">Your total is PHP 1,632.48.<br>See you soon.</p>");
    expect(m.text).toContain("PHP 741.24 x 2");                       // the items are still added
  });
  it("escapes the admin's text in the HTML, never lets it add markup", () => {
    const m = renderOrderEmail("order_paid", order, items, "", { heading: "<script>alert(1)</script>", body: "<img src=x onerror=alert(1)>" });
    expect(m.html).not.toMatch(/<script|<img src=x/);
    expect(m.html.match(/<img/g)).toHaveLength(1);                         // only the Teenfresh logo, never an image from the admin's text
    expect(m.html).toContain('src="https://teenfresh-events.web.app/email/logo.png"');
    expect(m.html).toContain("&lt;script&gt;");
  });
  it("the shipped email names the courier and tracking number; other emails do not", () => {
    const o = { ...order, courier: "J&T Express", tracking_number: "JT123" };
    const m = renderOrderEmail("order_shipped", o, items, "");
    expect(m.text).toContain("Courier: J&T Express");
    expect(m.text).toContain("Tracking number: JT123");
    expect(m.html).toContain("J&amp;T Express");
    expect(renderOrderEmail("order_paid", o, items, "").text).not.toContain("Tracking number");
    expect(renderOrderEmail("order_shipped", { ...o, tracking_number: null }, items, "").text).not.toContain("Tracking number");
    expect(renderOrderEmail("order_shipped", order, items, "").text).not.toContain("Courier:");   // older orders have none
  });
  it("the payment-short email names the amount to send, and every other email leaves it out", () => {
    const o = { ...order, balance_due_php: "250.00", balance_status: "awaiting_payment" };
    const m = renderOrderEmail("order_balance_due", o, items, "https://shop.example/");
    expect(m.subject).toContain("TF-000007");
    expect(m.text).toContain("send the remaining PHP 250.00 by GCash");              // the {{Amount Due}} placeholder in the wording
    expect(m.text).toContain("Amount to pay now: PHP 250.00");
    expect(m.html).toContain("Amount to pay now:");
    expect(m.html).toContain('href="https://shop.example/orders/o1"');                // the shopper opens their order to upload the receipt
    expect(renderOrderEmail("order_paid", o, items, "").text).not.toContain("Amount to pay now");
  });
  it("the shipping-fee email shows only the fee: no order prices, no order total", () => {
    const o = { ...order, shipping_fee_php: "150.00", shipping_status: "awaiting_payment" };
    const m = renderOrderEmail("order_shipping_due", o, items, "https://shop.example/");
    expect(m.text).toContain("Shipping fee to pay: PHP 150.00");
    expect(m.text).toContain("x 2");                                   // what was ordered, without prices
    expect(m.text).not.toContain("741.24");
    expect(m.text).not.toContain("1,482.48");
    expect(m.html).toContain("Shipping fee to pay");
    expect(m.html).not.toContain("Total paid");
    expect(m.html).not.toContain("741.24");
    expect(renderOrderEmail("order_paid", o, items, "").text).toContain("Total paid (GCash)");   // the other emails keep their totals
  });
  it("names the chosen version of a product in the email", () => {
    const withVersion = [{ artist: "Marv", title: "ÖRBITAL", variation_name: "Version B & more", unit_price_php: "900", quantity: 2 }];
    const m = renderOrderEmail("order_paid", order, withVersion, "");
    expect(m.text).toContain("Marv: ÖRBITAL (Version B & more)");
    expect(m.html).toContain("Version: Version B &amp; more");
    expect(renderOrderEmail("order_paid", order, items, "").html).not.toContain("Version:");          // a product without one is unchanged
  });
  it("falls back to the built-in wording for an empty or missing part", () => {
    const m = renderOrderEmail("order_shipped", order, items, "", { subject: "  ", heading: undefined, body: "" });
    expect(m.subject).toBe("Your order TF-000007 has shipped");
    expect(m.text).toContain(DEFAULT_TEMPLATES.order_shipped.heading);
  });
  it("finds placeholders that do not exist, and leaves them as typed", () => {
    expect(unknownOrderFields("Hi {{Name}}, {{Nmae}} {{ order  number }} {{Tracking}}")).toEqual(["Nmae", "Tracking"]);
    expect(fillOrderFields("{{Nmae}} {{Name}}", { Name: "Ana" })).toBe("{{Nmae}} Ana");
  });
});
