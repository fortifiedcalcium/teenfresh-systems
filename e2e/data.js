// The fake database of the browser tests (shared by the in-browser mock in fixtures.js and the Node server in fake-supabase.mjs).
export const future = new Date(Date.now() + 30 * 864e5).toISOString();
export const ev = {
  id: "e1", slug: "ivemon-odd-platinum", title: "IVEMON: ODD PLATINUM Cupsleeve Event", subtitle: "IVE's Kim Gaeul Cupsleeve Event hosted by Teenfresh", event_date: future, ends_at: future, registration_deadline: future,
  venue: "Psicom Blue Club", venue_address: "6 Yale St., Cubao, Quezon City, Philippines, 1109", price_info: "100 PHP", capacity: 100, registration_open: true, ticket_prefix: "IVEMONOP", description: "", created_at: future,
  registration_fee: 100, fee_note: "exclusive of food and drinks", hashtags: ["#IVEMON_OP", "#Teenfresh", "#IVE", "#Gaeul"], kit_inclusions: ["(1) Cupsleeve", "(1) Trading Card", "(2) Mezastar Tags"],
  payment_account_name: "BR**N CA**O S.", payment_account_number: "09171234567", send_ack_email: false, receipt_retention_days: 30,
  contact_links: [{ label: "Facebook", url: "https://www.facebook.com/TeenfreshPH" }, { label: "X", url: "https://x.com/TeenfreshPH" }, { label: "Gmail", url: "mailto:teenfreshph@gmail.com" }],
  terms_html: '<p>Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before filling up the form.</p><ol><li>Be 101% sure before you place your order(s).</li><li>Strictly <strong>NO CANCELLATION</strong> of order(s) and/or <strong>REFUNDS</strong>.</li><li>1 Form = 1 Entry per person only.</li></ol>',
};
const payment = (over = {}) => ({ id: "p1", event_id: "e1", user_id: "u1", sender_name: "Juan D.", amount_paid: 100, reference_number: "1234567890123", receipt_path: "u1/00000000-0000-4000-8000-000000000001.png", receipt_history: [], reference_history: [], status: "pending", amount_due: null, review_note: null, resubmission_count: 0, created_at: future,
  sender_profile: { email: "juan@example.com", full_name: "Juan Dela Cruz" }, registrations: [{ id: "r1", name: "Juan Dela Cruz", x_username: "juan_dc", facebook_url: "https://www.facebook.com/juan", status: "pending_verification", ticket_number: null, kit_name: "Standard kit", kit_quantity: 1, total_amount: 100 }], ...over });
const reg = { id: "r1", event_id: "e1", user_id: "u1", name: "Juan Dela Cruz", x_username: "juan_dc", email: "juan@example.com", contact_number: null, ticket_number: "IVEMON-000001", status: "confirmed", checked_in_at: null, kit_claimed: false, receipt_verified: false, created_at: future, checker: null, events: { title: ev.title, event_date: future, venue: ev.venue } };
export const profiles = [{ id: "u1", email: "juan@example.com", full_name: "Juan Dela Cruz", role: "attendee", created_at: future }, { id: "u2", email: "admin@example.com", full_name: "Admin", role: "admin", created_at: future }];

export const TABLES = {
  events: [ev, { ...ev, id: "e2", slug: "a-sold-out-event", title: "A sold-out event", registration_fee: 0, banner_coming_soon: true }, { ...ev, id: "e3", slug: "a-closed-event", title: "A closed event", registration_deadline: new Date(Date.now() - 864e5).toISOString() }],
  event_kits: [
    { id: "ka", event_id: "e1", name: "Standard kit", description: "(1) Cupsleeve, (1) Trading Card, (2) Mezastar Tags", unit_price: 100, max_per_order: 5, active: true, sort_order: 0, created_at: future },
    { id: "kb", event_id: "e1", name: "Deluxe kit", description: "Everything in the Standard kit plus a poster", unit_price: 250.5, max_per_order: 2, active: true, sort_order: 1, created_at: future },
  ],
  payments: [payment(), payment({ id: "p2", user_id: "u9", sender_name: "Maria S.", amount_paid: 80, reference_number: "9876543210987", registrations: [{ id: "r5", name: "Maria Santos", x_username: "maria", facebook_url: "https://www.facebook.com/maria", status: "pending_verification", ticket_number: null, kit_name: "Deluxe kit", kit_quantity: 1, total_amount: 250.5 }] })],
  event_images: [],
  // the shop: a new product with two versions at different prices, a low-stock one, a sold-out one and a pre-order
  products: [
    { id: "pa", slug: "orbital", artist: "Marv", title: "ÖRBITAL", price: 750, discount_percent: 10, pre_order: false, is_new: true, categories: ["ALBUM"], image_path: null, image_alt: "", active: true, created_at: future, info_description: "The debut album.", info_images: [], variation_layers: [] },
    { id: "pb", slug: "light-stick", artist: "IVE", title: "Light stick", price: 1200, discount_percent: 0, pre_order: false, is_new: false, categories: ["MD"], image_path: null, image_alt: "", active: true, created_at: future, info_images: [], variation_layers: [] },
    { id: "pc", slug: "photocard-set", artist: "Teenfresh", title: "Photocard set", price: 180, discount_percent: 0, pre_order: false, is_new: false, categories: ["MD"], image_path: null, image_alt: "", active: true, created_at: future, info_images: [], variation_layers: [] },
    { id: "pd", slug: "season-greetings", artist: "Teenfresh", title: "Season's greetings", price: 900, discount_percent: 0, pre_order: true, is_new: false, categories: ["ALBUM", "SINGLE"], image_path: null, image_alt: "", active: true, created_at: future, info_images: [], variation_layers: [] },
    // an ended pre-order (its last day was in 2020) and a plain product whose own stock is 0
    { id: "pe", slug: "ended-preorder", artist: "Teenfresh", title: "Ended pre-order", price: 300, discount_percent: 0, pre_order: true, pre_order_starts_on: "2019-12-01", pre_order_ends_on: "2020-01-01", is_new: false, categories: [], image_path: null, image_alt: "", active: true, created_at: future, info_images: [], variation_layers: [] },
    { id: "pf", slug: "plain-sold-out", artist: "Teenfresh", title: "Plain sold out", price: 150, discount_percent: 0, pre_order: false, stock: 0, is_new: false, categories: [], image_path: null, image_alt: "", active: true, created_at: future, info_images: [], variation_layers: [] },
  ],
  product_variations: [
    { id: "va", product_id: "pa", name: "Version A", price: null, stock: 20, active: true, position: 0, options: null },
    { id: "vb", product_id: "pa", name: "Version B", price: 900, stock: 20, active: true, position: 1, options: null },
    { id: "vx", product_id: "pa", name: "Version C", price: 600, stock: 0, active: true, position: 2, options: null },   // the cheapest, sold out: the shop shows From 750
    { id: "vc", product_id: "pb", name: "Standard", price: null, stock: 3, active: true, position: 0, options: null },
    { id: "vd", product_id: "pc", name: "Standard", price: null, stock: 0, active: true, position: 0, options: null },
  ],
  product_categories: [{ id: 1, name: "ALBUM" }, { id: 2, name: "MD" }, { id: 3, name: "SINGLE" }, { id: 4, name: "LIMITED" }],
  home_settings: [{ id: true, banner_path: "home/banner.jpg", banner_alt: "A crowd at the show", banner_decorative: false, featured_event_id: null, hero_headline: null, hero_description: null }],
  shop_settings: [{ id: true, gcash_account_name: "BR**N CA**O S.", gcash_account_number: "09171234567", gcash_qr_path: null }],
  event_availability: [{ event_id: "e1", registered: 93 }, { event_id: "e2", registered: 100 }, { event_id: "e3", registered: 10 }],
  registrations: [{ ...reg, kit_name: "Standard kit", kit_quantity: 2, kit_unit_price: 100, total_amount: 200, facebook_url: "https://www.facebook.com/juan", payment: { status: "verified", amount_paid: 100, reference_number: "1234567890123" }, payments: { id: "p1", status: "verified", review_note: null, amount_due: null, amount_paid: 100, reference_number: "1234567890123", sender_name: "Juan D." }, payment_id: "p1", events: { title: ev.title, event_date: future, venue: ev.venue, registration_fee: 100 } }, { ...reg, id: "r2", user_id: "u3", name: "Maria Santos", ticket_number: "IVEMON-000002", checked_in_at: future, checker: { full_name: "Admin", email: "admin@example.com" } }, { ...reg, id: "r3", user_id: "u1", name: "Maria Santos", x_username: "maria", ticket_number: null, status: "pending_verification", payment_id: "p3", payment: { status: "underpaid", amount_paid: 95, reference_number: "9876543210987" }, payments: { id: "p3", status: "underpaid", review_note: "A transaction fee was deducted", amount_due: 5, amount_paid: 95, reference_number: "9876543210987", sender_name: "Maria S." } }],
  registration_email_status: [{ registration_id: "r1", event_id: "e1", status: "sent", error: null, sent_at: future }],
  email_templates: [{ event_id: "e1", kind: "confirmation", subject: "Confirmation email - IVEMON", html_body: "<p>Hello {{Name}}</p>{{Terms}}", text_body: "Hello {{Name}}\n\n{{Terms}}" }],
  email_logs: [{ id: 1, registration_id: "r1", recipient: "juan@example.com", kind: "confirmation", status: "failed", error: "Resend 403", sent_at: future, registrations: { event_id: "e1", ticket_number: "IVEMON-000001", name: "Juan Dela Cruz" } }],
  attendance_logs: [{ id: 1, ticket_number_scanned: "IVEMON-000001", result: "success", scanned_at: future, registrations: { name: "Juan Dela Cruz", event_id: "e1" }, scanner: { full_name: "Admin", email: "admin@example.com" } }],
};
