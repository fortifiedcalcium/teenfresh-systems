// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { check } from "./helpers/a11y.js";

vi.mock("../src/lib/supabaseClient.js", async () => import("./helpers/mockSupabase.js"));
vi.mock("../src/context/AuthContext.jsx", async () => { const m = await import("./helpers/mockSupabase.js"); return { useAuth: () => m.authState.current }; });

import { LiveRegionProvider } from "../src/a11y.jsx";
import { ToastProvider } from "../src/components/Toast.jsx";
import { asGuest, asUser, fixtures } from "./helpers/mockSupabase.js";
import Login from "../src/pages/auth/Login.jsx";
import Register from "../src/pages/auth/Register.jsx";
import ForgotPassword from "../src/pages/auth/ForgotPassword.jsx";
import ResetPassword from "../src/pages/auth/ResetPassword.jsx";
import Callback from "../src/pages/auth/Callback.jsx";
import Home from "../src/pages/attendee/Home.jsx";
import EventRegister from "../src/pages/attendee/EventRegister.jsx";
import MyRegistrations from "../src/pages/attendee/MyRegistrations.jsx";
import MyTicket from "../src/pages/attendee/MyTicket.jsx";
import Dashboard from "../src/pages/admin/Dashboard.jsx";
import Events from "../src/pages/admin/Events.jsx";
import Attendees from "../src/pages/admin/Attendees.jsx";
import Payments from "../src/pages/admin/Payments.jsx";
import KitsTab from "../src/pages/admin/KitsTab.jsx";
import Scanner from "../src/pages/admin/Scanner.jsx";
import Tracker from "../src/pages/admin/Tracker.jsx";
import EmailTemplates from "../src/pages/admin/EmailTemplates.jsx";
import Users from "../src/pages/admin/Users.jsx";
import ChangeLog from "../src/pages/admin/ChangeLog.jsx";

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const ev = {
  id: "e1", title: "IVEMON: ODD PLATINUM Cupsleeve Event", subtitle: "IVE's Kim Gaeul Cupsleeve Event hosted by Teenfresh", event_date: future, ends_at: future, registration_deadline: future,
  venue: "Psicom Blue Club", venue_address: "6 Yale St., Cubao, Quezon City", price_info: "100 PHP", capacity: 100, registration_open: true, ticket_prefix: "IVEMONOP", created_at: future, description: "",
  registration_fee: 100, fee_note: "exclusive of food and drinks", hashtags: ["#IVEMON_OP", "#Teenfresh"], kit_inclusions: ["(1) Cupsleeve", "(1) Trading Card", "(2) Mezastar Tags"],
  payment_account_name: "BR**N CA**O S.", payment_account_number: "09171234567", send_ack_email: false, receipt_retention_days: null,
  contact_links: [{ label: "Facebook", url: "https://www.facebook.com/TeenfreshPH" }, { label: "Gmail", url: "mailto:teenfreshph@gmail.com" }],
  terms_html: "<p>Please read these Terms.</p><ol><li>Strictly <strong>NO CANCELLATION</strong>.</li><li>Be 101% sure.</li></ol>",
};
const reg = { id: "r1", event_id: "e1", user_id: "u1", name: "Juan Dela Cruz", x_username: "juan", email: "juan@example.com", facebook_url: "https://www.facebook.com/juan", contact_number: "+639171234567", notes: null, ticket_number: "IVEMON-000001", status: "confirmed", payment_id: "p1", checked_in_at: null, kit_claimed: false, receipt_verified: false, created_at: future, checker: null, payment: { status: "verified", amount_paid: 100, reference_number: "1234567890123" }, payments: { id: "p1", status: "verified", review_note: null, amount_due: null, amount_paid: 100, reference_number: "1234567890123", sender_name: "Juan D." }, events: { title: ev.title, event_date: future, venue: "Psicom Blue Club", registration_fee: 100 } };
const payment = (over = {}) => ({ id: "p1", event_id: "e1", user_id: "u1", sender_name: "Juan D.", amount_paid: 100, reference_number: "1234567890123", receipt_path: "u1/receipt.png", receipt_history: [], reference_history: [], status: "pending", amount_due: null, review_note: null, resubmission_count: 0, created_at: future,
  sender_profile: { email: "juan@example.com", full_name: "Juan" }, registrations: [{ id: "r1", name: "Juan Dela Cruz", x_username: "juan", facebook_url: "https://www.facebook.com/juan", status: "pending_verification", ticket_number: null, kit_name: "Event kit", kit_quantity: 1, total_amount: 100 }], ...over });

const kitA = { id: "ka", event_id: "e1", name: "Standard kit", description: "(1) Cupsleeve, (1) Trading Card", unit_price: 100, max_per_order: 5, active: true };
const kitB = { id: "kb", event_id: "e1", name: "Deluxe kit", description: "Everything in Standard plus a poster", unit_price: 250.5, max_per_order: 2, active: true };

beforeEach(() => {
  sessionStorage.clear();   // the registration form saves unsent progress there
  asGuest();
  fixtures.current = {
    events: [ev, { ...ev, id: "e2", title: "Sold out event" }],
    event_availability: [{ event_id: "e1", registered: 95 }, { event_id: "e2", registered: 100 }],
    registrations: [reg, { ...reg, id: "r2", name: "Maria Santos", ticket_number: "IVEMON-000002", checked_in_at: future, checker: { full_name: "Admin", email: "a@x.io" } }],
    payments: [payment()],
    event_images: [],
    registration_email_status: [{ registration_id: "r1", status: "failed", error: "x", sent_at: future, event_id: "e1" }],
    change_log: [{ id: 2, at: future, actor_id: "u2", actor_email: "admin@example.com", table_name: "payments", row_id: "p1", event_id: "e1", action: "update", label: "payment ab12cd34", changes: { status: { old: "pending", new: "verified" } } }, { id: 1, at: future, actor_id: null, actor_email: null, table_name: "events", row_id: "e1", event_id: "e1", action: "insert", label: "Event", changes: { title: "Event", capacity: "50" } }],
    profiles: [{ id: "u1", email: "juan@example.com", full_name: "Juan", role: "attendee", created_at: future }, { id: "u2", email: "admin@example.com", full_name: "Admin", role: "admin", created_at: future }],
    email_templates: [{ subject: "Confirmation", html_body: "<p>Hello {{Name}}</p>{{Terms}}", text_body: "Hello {{Name}}" }],
    email_logs: [{ id: 1, registration_id: "r1", recipient: "juan@example.com", kind: "confirmation", status: "failed", error: "boom", sent_at: future, registrations: { event_id: "e1", ticket_number: "IVEMON-000001", name: "Juan" } }],
    attendance_logs: [{ id: 1, ticket_number_scanned: "IVEMON-000001", result: "success", scanned_at: future, registrations: { name: "Juan", event_id: "e1" }, scanner: { full_name: "Admin", email: "a@x.io" } }],
  };
});

const shell = (ui) => <LiveRegionProvider><ToastProvider>{ui}</ToastProvider></LiveRegionProvider>;
const page = (path, element, initial = path) => render(shell(<MemoryRouter initialEntries={[initial]}><Routes><Route path={path} element={element} /></Routes></MemoryRouter>));
const admin = (element) => render(shell(
  <MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/admin" element={<Outlet context={{ events: fixtures.current.events, event: ev, reloadEvents() {} }} />}><Route index element={element} /></Route></Routes></MemoryRouter>));
const settled = async (name) => { await screen.findAllByRole("heading", { level: 1, name }); await new Promise((r) => setTimeout(r, 50)); };

describe("public and auth pages", () => {
  it.each([["Login", "/login", <Login />, "Sign in"], ["Register", "/register", <Register />, "Create an account"], ["ForgotPassword", "/forgot-password", <ForgotPassword />, "Forgot your password?"], ["ResetPassword (expired link)", "/reset-password", <ResetPassword />, "Link expired"], ["Callback", "/auth/callback", <Callback />, null]])("%s has one h1 and no violations", async (_n, path, el, h1) => {
    const { container } = page(path, el);
    if (h1) await screen.findByRole("heading", { level: 1, name: h1 });
    expect(container.querySelectorAll("h1").length).toBeLessThanOrEqual(1);
    expect(await check(container)).toHaveNoViolations();
  });

  it("Login: failed submit shows an error summary that takes focus, linked to the fields", async () => {
    const user = userEvent.setup();
    const { container } = page("/login", <Login />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const summary = await screen.findByRole("alert", { name: /problems? with your submission/ });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Email/)).toHaveAccessibleDescription(/Enter your email address/);
    expect(await check(container)).toHaveNoViolations();
  });

  it("Register: password rules are listed before the field; autocomplete attributes set", async () => {
    const { container } = page("/register", <Register />);
    const html = container.innerHTML;
    expect(html.indexOf("At least 8 characters")).toBeLessThan(html.indexOf('id="password"'));
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText(/^Full name/)).toHaveAttribute("autocomplete", "name");
    expect(container.querySelector("#password")).toHaveAttribute("autocomplete", "new-password");
    expect(await check(container)).toHaveNoViolations();
  });
});

describe("attendee pages", () => {
  it("Home: event cards", async () => {
    const { container } = page("/", <Home />);
    await screen.findByText("Sold out event");
    expect(await check(container)).toHaveNoViolations();
    expect(screen.getByText("5 of 100 slots left")).toBeInTheDocument();
    expect(screen.getAllByText("Few slots left").length).toBeGreaterThan(0);
  });

  const fillStep1 = async (user) => { await user.click(screen.getByRole("checkbox", { name: /agree to the Terms/ })); await user.click(screen.getByRole("button", { name: "Next" })); };
  const fillStep2 = async (user) => {
    await user.clear(screen.getByLabelText(/^Name/));                              // pre-filled from the account
    await user.type(screen.getByLabelText(/^Name/), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/^X\/Twitter Username/), "@juan_dc");
    await user.type(screen.getByLabelText(/^Facebook Profile Link/), "fb.com/TeenfreshPH");
    await user.type(screen.getByLabelText(/^Contact Number/), "09171234567");
    await user.click(screen.getByRole("button", { name: "Next" }));
  };

  it("EventRegister: the four steps, per-step errors, review, submit and the status page", async () => {
    asUser();
    fixtures.current.payments = [];                                // no earlier payments to reuse
    fixtures.current.rpc = { submit_registration: { registration_id: "rnew", payment_id: "pnew", status: "pending_verification", ticket_number: null } };
    const user = userEvent.setup({ applyAccept: false });
    const { container } = page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });

    // header: real text, not only images
    expect(screen.getByText("1 Form = 1 Entry")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toBeInTheDocument();
    expect(screen.getByText("* Indicates required question")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Registration progress" })).toBeInTheDocument();

    // step 1: placeholders (no images uploaded), terms from terms_html, contact links, kit inclusions
    expect(screen.getByRole("heading", { level: 2, name: "Event info and terms" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveValue("juan@example.com");
    expect(screen.getByText("Event poster image coming soon")).toBeInTheDocument();
    expect(screen.getByText("Event details image coming soon")).toBeInTheDocument();
    expect(screen.getByText("NO CANCELLATION").tagName).toBe("STRONG");
    expect(screen.getByRole("list", { name: "Contact links" })).toBeInTheDocument();
    expect(screen.getByText("(2) Mezastar Tags")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Next" }));                 // agreement missing
    const summary = await screen.findByRole("alert", { name: /problem/ });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByRole("checkbox", { name: /agree/ })).toHaveAttribute("aria-invalid", "true");
    expect(await check(container)).toHaveNoViolations();
    await fillStep1(user);

    // step 2
    const h2 = await screen.findByRole("heading", { level: 2, name: "Participant's information" });
    await waitFor(() => expect(h2).toHaveFocus());                                  // focus moves to the step heading
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Participant");
    expect(screen.getByLabelText(/^X\/Twitter Username/)).toHaveAccessibleDescription(/without "@" sign/);
    expect(screen.getByLabelText(/^Facebook Profile Link/)).toHaveAccessibleDescription(/fb.com\/TeenfreshPH/);
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Next" }));                 // the name is pre-filled from the account, the other three are empty
    expect((await screen.findByRole("alert", { name: /3 problems/ }))).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^X\/Twitter Username/), "@@juan_dc");
    await user.tab();
    expect(screen.getByLabelText(/^X\/Twitter Username/)).toHaveValue("juan_dc");   // a leading @ is stripped when you leave the field
    await user.clear(screen.getByLabelText(/^X\/Twitter Username/));
    await fillStep2(user);

    // step 3: payment
    await screen.findByRole("heading", { level: 2, name: "Payment" });
    expect(screen.getByRole("heading", { name: "PAYMENT METHOD" })).toBeInTheDocument();
    expect(screen.getByText("BR**N CA**O S.")).toBeInTheDocument();
    expect(screen.getByText("09171234567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy number" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QR CODE" })).toBeInTheDocument();
    expect(screen.getByText("GCash QR code image coming soon")).toBeInTheDocument();
    expect(screen.getByText(/avoid using the "Money Protect" feature/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/earlier forms/)).toBeNull();                    // nothing to reuse yet
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    const paySummary = await screen.findByRole("alert", { name: /problems/ });
    expect(paySummary).toHaveTextContent(/Name of sender/); expect(paySummary).toHaveTextContent(/Payment receipt/);
    await user.type(screen.getByLabelText(/^Name of Sender/), "Juan D.");
    await user.type(screen.getByLabelText(/^Amount Paid/), "50");
    await user.type(screen.getByLabelText(/^Reference Number/), "123456789012");
    await user.upload(container.querySelector("#receipt"), new File(["r"], "gcash.png", { type: "image/png" }));
    expect(await screen.findByText(/usually 13 digits/)).toBeInTheDocument();       // a warning, not an error
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    expect((await screen.findAllByText(/at least 100.00 PHP/)).length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText(/^Amount Paid/)); await user.type(screen.getByLabelText(/^Amount Paid/), "100");
    await user.type(screen.getByLabelText(/^Notes/), "hello");
    expect(screen.getByLabelText(/^Notes/)).toHaveAccessibleDescription("5 of 500 characters");
    await user.click(screen.getByRole("button", { name: "Review registration" }));

    // step 4: review (everything normalised) and submit
    const reviewH = await screen.findByRole("heading", { level: 2, name: "Review and submit" });
    await waitFor(() => expect(reviewH).toHaveFocus());
    expect(screen.getByText("@juan_dc")).toBeInTheDocument();
    expect(screen.getByText("https://www.facebook.com/TeenfreshPH")).toBeInTheDocument();
    expect(screen.getByText("+639171234567")).toBeInTheDocument();
    expect(screen.getByText("₱100.00")).toBeInTheDocument();
    expect(screen.getByText(/gcash.png/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Edit / }).length).toBe(3);
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Edit Participant's information" }));
    expect(await screen.findByLabelText(/^Name/)).toHaveValue("Juan Dela Cruz");     // values survive going back
    await user.click(screen.getByRole("button", { name: "Next" })); await screen.findByRole("heading", { level: 2, name: "Payment" });
    expect(screen.getByLabelText(/^Amount Paid/)).toHaveValue("100");
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    await user.click(await screen.findByRole("button", { name: "Submit registration" }));

    // status page
    const done = await screen.findByRole("heading", { level: 1, name: "Registration received" });
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
    expect(screen.getByText(/within 48 to 72 hours/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/IVEMONOP-0/);                         // no ticket yet
    expect(await check(container)).toHaveNoViolations();
    // what was sent: the receipt in the private bucket under the user's own folder, a random name, then the RPC
    const { storageLog } = await import("./helpers/mockSupabase.js");
    const up = storageLog.uploads.at(-1);
    expect(up).toMatchObject({ bucket: "payment-receipts", type: "image/png" });
    expect(up.path).toMatch(/^u1\/[0-9a-f-]{36}\.png$/);
    expect(up.path).not.toContain("gcash");
    const call = fixtures.current.rpcCalls.find((c) => c.name === "submit_registration").args;
    expect(call).toMatchObject({ p_event_id: "e1", p_name: "Juan Dela Cruz", p_x_username: "juan_dc", p_facebook: "fb.com/TeenfreshPH", p_contact: "09171234567", p_agreed: true, p_amount: 100, p_reference: "123456789012", p_receipt_path: up.path, p_payment_id: null });
    expect(fixtures.current.fnCalls ?? []).toHaveLength(0);                           // acknowledgment emails are off by default
  });

  it("EventRegister: typing in a field never loses focus to the error summary (regression: focus was stolen after one character)", async () => {
    asUser();
    fixtures.current.payments = [];
    const user = userEvent.setup();
    page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });
    await fillStep1(user);                                                              // a successful submit: the form is now in "re-validate as you type" mode
    await screen.findByRole("heading", { level: 2, name: "Participant's information" });
    const fb = screen.getByLabelText(/^Facebook Profile Link/);
    await user.click(fb);
    await user.keyboard("fb.com/TeenfreshPH");                                          // the first characters are an invalid link, so errors appear and disappear while typing
    expect(fb).toHaveValue("fb.com/TeenfreshPH");
    expect(fb).toHaveFocus();
    const phone = screen.getByLabelText(/^Contact Number/);
    await user.click(phone);
    await user.keyboard("0917123");
    expect(phone).toHaveValue("0917123"); expect(phone).toHaveFocus();
    expect(screen.queryByRole("alert", { name: /problem/ })).toBeNull();               // nothing was "submitted", so no summary yet
  });

  it("EventRegister: one earlier payment can be reused, which locks the fields and needs no new receipt", async () => {
    asUser();
    fixtures.current.payments = [{ id: "pay1", sender_name: "Juan D.", amount_paid: 200, reference_number: "5550001112223", status: "pending", registrations: [{ id: "r1", status: "pending_verification", total_amount: 100 }] }];
    fixtures.current.rpc = { submit_registration: { registration_id: "r2", payment_id: "pay1", status: "pending_verification", ticket_number: null } };
    const user = userEvent.setup();
    const { container } = page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });
    await fillStep1(user);
    await screen.findByRole("heading", { level: 2, name: "Participant's information" });
    await fillStep2(user);
    await screen.findByRole("heading", { level: 2, name: "Payment" });
    const select = screen.getByLabelText("Use the payment details from one of my earlier forms");
    expect(select).toHaveTextContent("₱100.00 left");
    await user.selectOptions(select, "pay1");
    expect(screen.getByLabelText(/^Name of Sender/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Amount Paid/)).toHaveValue("200");
    expect(screen.queryByText("Files submitted:")).toBeNull();                      // no file needed
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    await user.click(await screen.findByRole("button", { name: "Submit registration" }));
    await screen.findByRole("heading", { level: 1, name: "Registration received" });
    expect(fixtures.current.rpcCalls.find((c) => c.name === "submit_registration").args).toMatchObject({ p_payment_id: "pay1", p_receipt_path: null });
  });

  it("EventRegister: a server error (duplicate X username) is shown in plain words on the review step", async () => {
    asUser();
    fixtures.current.payments = [{ id: "pay1", sender_name: "Juan D.", amount_paid: 100, reference_number: "5550001112223", status: "verified", registrations: [] }];
    fixtures.current.rpc = { submit_registration: { error: { message: "ALREADY_REGISTERED" } } };
    const user = userEvent.setup();
    page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });
    await fillStep1(user); await screen.findByRole("heading", { level: 2, name: "Participant's information" }); await fillStep2(user);
    await screen.findByRole("heading", { level: 2, name: "Payment" });
    await user.selectOptions(screen.getByLabelText(/earlier forms/), "pay1");
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    await user.click(await screen.findByRole("button", { name: "Submit registration" }));
    expect(await screen.findByText(/already registered for this event/)).toBeInTheDocument();
  });

  it("EventRegister with kits: choose a kit and a quantity, see the total, pay at least that, and send the order", async () => {
    asUser();
    fixtures.current.payments = [];
    fixtures.current.event_kits = [kitA, kitB];
    fixtures.current.rpc = { submit_registration: { registration_id: "rnew", payment_id: "pnew", status: "pending_verification", ticket_number: null, kit_name: "Deluxe kit", kit_quantity: 2, total_amount: 501 } };
    const user = userEvent.setup({ applyAccept: false });
    const { container } = page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });
    expect(screen.getByText(/Standard kit: ₱100.00 each \(up to 5 per form\)/)).toBeInTheDocument();   // the header lists the kits as text
    expect(screen.getAllByRole("listitem").some((li) => /Kit and quantity/.test(li.textContent))).toBe(true);   // the extra step is in the progress list
    await fillStep1(user); await screen.findByRole("heading", { level: 2, name: "Participant's information" }); await fillStep2(user);

    // the kit step
    const h = await screen.findByRole("heading", { level: 2, name: "Kit and quantity" });
    await waitFor(() => expect(h).toHaveFocus());
    expect(screen.getByRole("radio", { name: /Standard kit/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Deluxe kit/ })).toBeInTheDocument();
    expect(screen.getByText("₱250.50 each")).toBeInTheDocument();
    expect(screen.getByText("Up to 2 per form")).toBeInTheDocument();
    expect(screen.getByText(/^(Total to pay|Choose a kit and a quantity)/)).toHaveTextContent("Choose a kit and a quantity to see the total.");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Next" }));                          // nothing chosen yet
    const summary = await screen.findByRole("alert", { name: /problem/ });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(summary).toHaveTextContent(/Kit: Choose a kit/);
    expect(await check(container)).toHaveNoViolations();

    await user.click(screen.getByRole("radio", { name: /Deluxe kit/ }));
    expect(screen.getByLabelText(/^Quantity/)).toHaveAccessibleDescription("Up to 2 of this kit per form.");
    expect(screen.getByText(/^(Total to pay|Choose a kit and a quantity)/)).toHaveTextContent("Total to pay: 1 × ₱250.50 = ₱250.50");
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(2);
    expect(screen.getByText(/^(Total to pay|Choose a kit and a quantity)/)).toHaveTextContent("Total to pay: 2 × ₱250.50 = ₱501.00");
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();       // at this kit's limit of 2
    await user.clear(screen.getByLabelText(/^Quantity/)); await user.type(screen.getByLabelText(/^Quantity/), "3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findAllByText(/up to 2 of this kit per form/)).not.toHaveLength(0);   // the limit is named in the error
    await user.clear(screen.getByLabelText(/^Quantity/)); await user.type(screen.getByLabelText(/^Quantity/), "2");
    await user.click(screen.getByRole("radio", { name: /Standard kit/ }));                   // switching kits keeps a valid quantity and re-prices
    expect(screen.getByText(/^(Total to pay|Choose a kit and a quantity)/)).toHaveTextContent("Total to pay: 2 × ₱100.00 = ₱200.00");
    await user.click(screen.getByRole("radio", { name: /Deluxe kit/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // payment: the amount to pay is the order's total
    await screen.findByRole("heading", { level: 2, name: "Payment" });
    expect(screen.getByText("Amount to pay:")).toBeInTheDocument();
    expect(screen.getByText(/₱501.00 \(2 × Deluxe kit at ₱250.50\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Amount Paid/)).toHaveAccessibleDescription(/At least ₱501.00 \(2 × ₱250.50\)/);
    await user.type(screen.getByLabelText(/^Name of Sender/), "Juan D.");
    await user.type(screen.getByLabelText(/^Amount Paid/), "500");
    await user.type(screen.getByLabelText(/^Reference Number/), "1234567890123");
    await user.upload(container.querySelector("#receipt"), new File(["r"], "gcash.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Review registration" }));
    expect((await screen.findAllByText(/at least 501.00 PHP/)).length).toBeGreaterThan(0);   // 500 is not enough for 2 x 250.50
    await user.clear(screen.getByLabelText(/^Amount Paid/)); await user.type(screen.getByLabelText(/^Amount Paid/), "501");
    await user.click(screen.getByRole("button", { name: "Review registration" }));

    // review shows the order, and Edit goes back to it
    const reviewH = await screen.findByRole("heading", { level: 2, name: "Review and submit" });
    await waitFor(() => expect(reviewH).toHaveFocus());
    const kitSection = screen.getByRole("region", { name: "Kit and quantity" });
    expect(kitSection).toHaveTextContent("Deluxe kit"); expect(kitSection).toHaveTextContent("Quantity2"); expect(kitSection).toHaveTextContent("₱250.50"); expect(kitSection).toHaveTextContent("₱501.00");
    expect(screen.getAllByRole("button", { name: /^Edit / }).length).toBe(4);
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await screen.findByRole("heading", { level: 1, name: "Registration received" });
    const call = fixtures.current.rpcCalls.find((c) => c.name === "submit_registration").args;
    expect(call).toMatchObject({ p_kit_id: "kb", p_quantity: 2, p_amount: 501 });             // the browser sends the choice, never a price for the kit
    expect(Object.keys(call)).not.toContain("p_unit_price"); expect(Object.keys(call)).not.toContain("p_total");
  });

  it("EventRegister with a single kit: it is selected for you, and a payment is reused only when its balance covers the order", async () => {
    asUser();
    fixtures.current.event_kits = [kitA];
    fixtures.current.payments = [
      { id: "small", sender_name: "Small P.", amount_paid: 300, reference_number: "1110001112223", status: "pending", registrations: [{ id: "r1", status: "pending_verification", total_amount: 200 }] },   // 100 left
      { id: "big", sender_name: "Big P.", amount_paid: 1000, reference_number: "2220001112223", status: "verified", registrations: [{ id: "r2", status: "confirmed", total_amount: 100 }] },       // 900 left
    ];
    const user = userEvent.setup();
    page("/events/:id/register", <EventRegister />, "/events/e1/register");
    await screen.findByRole("heading", { level: 1, name: "Register" });
    await fillStep1(user); await screen.findByRole("heading", { level: 2, name: "Participant's information" }); await fillStep2(user);
    await screen.findByRole("heading", { level: 2, name: "Kit and quantity" });
    expect(screen.getByRole("radio", { name: /Standard kit/ })).toBeChecked();               // nothing to choose with one kit
    await user.clear(screen.getByLabelText(/^Quantity/)); await user.type(screen.getByLabelText(/^Quantity/), "3");   // 300
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { level: 2, name: "Payment" });
    const select = screen.getByLabelText("Use the payment details from one of my earlier forms");
    expect(select).toHaveTextContent("Big P."); expect(select).not.toHaveTextContent("Small P.");   // only 100 left on the small one, the order needs 300
    expect(select).toHaveTextContent("₱900.00 left");
    expect(screen.getByLabelText(/earlier forms/)).toHaveAccessibleDescription(/This form costs ₱300.00/);
  });

  it("Kits tab: add, validate and save kits", async () => {
    asUser(true);
    fixtures.current.event_kits = [{ ...kitA }];
    const user = userEvent.setup();
    const { container } = render(shell(<MemoryRouter><KitsTab event={ev} /></MemoryRouter>));
    expect(await screen.findByDisplayValue("Standard kit")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Price per kit/)).toHaveValue("100");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Add a kit" }));
    await user.click(screen.getByRole("button", { name: "Save kits" }));
    const summary = await screen.findByRole("alert", { name: /problems/ });
    expect(summary).toHaveTextContent(/Kit 2: Enter the kit's name/); expect(summary).toHaveTextContent(/Kit 2: Enter a price above 0/);
    expect(fixtures.current.writes ?? []).toHaveLength(0);                                    // nothing is saved while there are errors
    expect(await check(container)).toHaveNoViolations();
    const fieldsets = screen.getAllByRole("group");
    const second = within(fieldsets[1]);
    await user.type(second.getByLabelText(/^Name/), "Deluxe kit");
    await user.type(second.getByLabelText(/^Price per kit/), "0");
    await user.click(screen.getByRole("button", { name: "Save kits" }));
    expect(await screen.findAllByText(/price above 0/)).not.toHaveLength(0);                  // 0 is not a price
    await user.clear(second.getByLabelText(/^Price per kit/)); await user.type(second.getByLabelText(/^Price per kit/), "250.5");
    await user.clear(second.getByLabelText(/^Most one form/)); await user.type(second.getByLabelText(/^Most one form/), "2");
    await user.clear(within(fieldsets[0]).getByLabelText(/^Price per kit/)); await user.type(within(fieldsets[0]).getByLabelText(/^Price per kit/), "120");
    await user.click(screen.getByRole("button", { name: "Save kits" }));
    await waitFor(() => expect((fixtures.current.writes || []).length).toBe(2));
    const [upd, ins] = fixtures.current.writes;
    expect(upd).toMatchObject({ table: "event_kits", op: "update" });
    expect(upd.args[0]).toMatchObject({ name: "Standard kit", unit_price: 120, max_per_order: 5, sort_order: 0 });
    expect(ins).toMatchObject({ table: "event_kits", op: "insert" });
    expect(ins.args[0]).toMatchObject({ event_id: "e1", name: "Deluxe kit", unit_price: 250.5, max_per_order: 2, active: true, sort_order: 1 });
  });

  it("Kits tab: removing a kit deletes it on save", async () => {
    asUser(true);
    fixtures.current.event_kits = [{ ...kitA }, { ...kitB }];
    const user = userEvent.setup();
    render(shell(<MemoryRouter><KitsTab event={ev} /></MemoryRouter>));
    await screen.findByDisplayValue("Deluxe kit");
    await user.click(screen.getByRole("button", { name: /Remove kit 2, Deluxe kit/ }));
    expect(screen.queryByDisplayValue("Deluxe kit")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save kits" }));
    await waitFor(() => expect(fixtures.current.writes.some((w) => w.op === "delete" && w.table === "event_kits")).toBe(true));
  });

  it("EventRegister: after the deadline, when sold out, or when closed the form is replaced by a clear message", async () => {
    asUser();
    for (const [over, reason] of [[{ registration_deadline: new Date(Date.now() - 864e5).toISOString() }, /deadline has passed/], [{ registration_open: false }, /closed by the organizers/]]) {
      fixtures.current.events = [{ ...ev, ...over }];
      const { container, unmount } = page("/events/:id/register", <EventRegister />, "/events/e1/register");
      expect(await screen.findByText(reason)).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Register" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
      expect(await check(container)).toHaveNoViolations();
      unmount();
    }
    fixtures.current.events = [ev];
    fixtures.current.event_availability = [{ event_id: "e1", registered: 100 }];
    page("/events/:id/register", <EventRegister />, "/events/e1/register");
    expect(await screen.findByText(/All slots are taken/)).toBeInTheDocument();
  });

  it("MyRegistrations and MyTicket", async () => {
    asUser();
    let r = page("/my-registrations", <MyRegistrations />);
    await screen.findByText("IVEMON-000001");
    expect(await check(r.container)).toHaveNoViolations();
    r.unmount();
    r = page("/my-ticket/:id", <MyTicket />, "/my-ticket/r1");
    await screen.findByRole("heading", { level: 1, name: "My ticket" });
    await screen.findByText(/Transfer your slot/);
    expect(await check(r.container)).toHaveNoViolations();
  });
});

describe("admin pages", () => {
  it("Dashboard", async () => { const { container } = admin(<Dashboard />); await settled("Dashboard"); expect(await check(container)).toHaveNoViolations(); });
  it("Events (list and edit dialog)", async () => {
    const user = userEvent.setup();
    const { container } = admin(<Events />); await settled("Events");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: /New event/ }));
    expect(screen.getByRole("dialog", { name: "New event" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
  it("Events: the editor has every new field, and the Media tab has one card per image slot", async () => {
    const user = userEvent.setup();
    const { container } = admin(<Events />); await settled("Events");
    await user.click(screen.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }));
    const dialog = screen.getByRole("dialog", { name: "Edit event" });
    for (const label of ["Title", "Subtitle", "Venue", "Address", "Registration fee \\(PHP\\)", "GCash account name \\(masked\\)", "GCash number", "Hashtags", "Kit inclusions", "Contact links", "Registration deadline"]) expect(within(dialog).getByLabelText(new RegExp(label))).toBeInTheDocument();
    expect(within(dialog).getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Delete payment receipts/)).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    await user.click(within(dialog).getByRole("tab", { name: "Media" }));
    const cards = await within(dialog).findAllByRole("heading", { level: 3 });
    expect(cards.map((h) => h.textContent)).toEqual(["Event poster", "Event details card", "GCash QR code", "Home page banner", "Confirmation email banner"]);
    expect(within(dialog).getAllByText(/Recommended:/).length).toBe(5);
    expect(within(dialog).getAllByText(/JPG, PNG or WebP, 5 MB at most/).length).toBeGreaterThanOrEqual(5);
    expect(within(dialog).getByText("Event poster image coming soon")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
  it("Media tab: upload, replace, alt text and remove for an image slot", async () => {
    const user = userEvent.setup();
    fixtures.current.event_images = [{ id: "i1", event_id: "e1", slot: "poster", storage_path: "e1/old.png", alt_text: "Old alt", updated_at: future }];
    admin(<Events />); await settled("Events");
    await user.click(screen.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }));
    const dialog = screen.getByRole("dialog", { name: "Edit event" });
    await user.click(within(dialog).getByRole("tab", { name: "Media" }));
    await within(dialog).findByText(/Last updated/);
    expect(within(dialog).getByLabelText("Alt text")).toHaveValue("Old alt");
    expect(within(dialog).getByText("Replace image", { exact: false })).toBeInTheDocument();
    const { storageLog } = await import("./helpers/mockSupabase.js");
    storageLog.uploads.length = 0;
    await user.upload(within(dialog).getByLabelText(/Replace image for Event poster/), new File(["x"], "new poster.PNG", { type: "image/png" }));
    await waitFor(() => expect(storageLog.uploads.at(-1)).toMatchObject({ bucket: "event-media", type: "image/png" }));
    expect(storageLog.uploads.at(-1).path).toMatch(/^e1\/poster-[0-9a-f-]{36}\.png$/);
    await waitFor(() => expect(storageLog.removed).toContain("e1/old.png"));          // the replaced file is cleaned up
    await user.click(within(dialog).getByRole("button", { name: /Remove Event poster/ }));
    expect(screen.getByRole("dialog", { name: "Remove Event poster?" })).toBeInTheDocument();
  });
  it("Media tab: a file that is not a JPG, PNG or WebP image is refused", async () => {
    const user = userEvent.setup({ applyAccept: false });
    admin(<Events />); await settled("Events");
    await user.click(screen.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }));
    const dialog = screen.getByRole("dialog", { name: "Edit event" });
    await user.click(within(dialog).getByRole("tab", { name: "Media" }));
    const { storageLog } = await import("./helpers/mockSupabase.js");
    storageLog.uploads.length = 0;
    await user.upload(await within(dialog).findByLabelText(/Upload image for Event poster/), new File(["x"], "poster.gif", { type: "image/gif" }));
    expect(await screen.findByText("Use a JPG, PNG or WebP image.")).toBeInTheDocument();
    expect(storageLog.uploads).toHaveLength(0);
  });

  it("Payments: the queue, the receipt viewer and the review actions", async () => {
    asUser(true);
    fixtures.current.rpc = { review_payment: { decision: "verified", registration_ids: ["r1"], ticket_numbers: ["IVEMONOP-000001"] } };
    const user = userEvent.setup();
    const { container } = admin(<Payments />); await settled("Payments");
    await screen.findByRole("table", { name: /Payments/ });
    expect(screen.getByText("1 payment found")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: /Review payment of Juan D./ }));
    const dialog = screen.getByRole("dialog", { name: /Payment of ₱100.00 from Juan D./ });
    expect(await within(dialog).findByAltText(/GCash receipt, reference 1234567890123/)).toHaveAttribute("src", "https://signed.test/u1/receipt.png");   // short-lived signed URL
    expect(within(dialog).getByText("Linked forms")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();

    await user.click(within(dialog).getByRole("button", { name: "Reject payment" }));
    const confirm = screen.getByRole("dialog", { name: "Reject this payment?" });
    await user.click(within(confirm).getByRole("button", { name: "Reject and email" }));
    expect(await within(confirm).findByText(/Give a reason/)).toBeInTheDocument();     // a reason is required
    expect(fixtures.current.rpcCalls ?? []).toHaveLength(0);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Reject this payment?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: /Payment of/ })).toBeInTheDocument();    // only the top dialog closed

    await user.click(within(screen.getByRole("dialog", { name: /Payment of/ })).getByRole("button", { name: "Verify payment" }));
    await user.click(within(screen.getByRole("dialog", { name: "Verify this payment?" })).getByRole("button", { name: "Verify and send tickets" }));
    await waitFor(() => expect(fixtures.current.rpcCalls.find((c) => c.name === "review_payment")?.args).toMatchObject({ p_payment_id: "p1", p_decision: "verified", p_override: false }));
    await waitFor(() => expect(fixtures.current.fnCalls.find((c) => c.name === "send-confirmation-email")?.body).toEqual({ registration_ids: ["r1"] }));   // the ticket email goes out
  });
  it("Payments: an amount below the fee is flagged and needs an override with a reason", async () => {
    asUser(true);
    fixtures.current.payments = [payment({ amount_paid: 80 })];
    const user = userEvent.setup();
    admin(<Payments />); await settled("Payments");
    await user.click(await screen.findByRole("button", { name: /Review payment of Juan D./ }));
    const dialog = screen.getByRole("dialog", { name: /Payment of ₱80.00/ });
    expect(within(dialog).getByText(/lower than expected \(₱100.00\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Verify payment" }));
    const confirm = screen.getByRole("dialog", { name: "Verify this payment?" });
    expect(within(confirm).getByRole("checkbox", { name: /Verify anyway/ })).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Verify and send tickets" }));
    expect(await within(confirm).findByText(/Tick “Verify anyway” and give a reason/)).toBeInTheDocument();
    expect(fixtures.current.rpcCalls ?? []).toHaveLength(0);
  });
  it("Payments: marking underpaid asks for the amount due", async () => {
    asUser(true);
    fixtures.current.payments = [payment({ amount_paid: 95 })];
    fixtures.current.rpc = { review_payment: { decision: "underpaid", registration_ids: [] } };
    const user = userEvent.setup();
    admin(<Payments />); await settled("Payments");
    await user.click(await screen.findByRole("button", { name: /Review payment of Juan D./ }));
    await user.click(within(screen.getByRole("dialog", { name: /Payment of/ })).getByRole("button", { name: "Mark underpaid" }));
    const confirm = screen.getByRole("dialog", { name: "Mark this payment as underpaid?" });
    expect(within(confirm).getByLabelText(/Amount still due/)).toHaveValue("5.00");    // prefilled with the shortfall
    await user.click(within(confirm).getByRole("button", { name: "Mark underpaid and email" }));
    await waitFor(() => expect(fixtures.current.rpcCalls.find((c) => c.name === "review_payment")?.args).toMatchObject({ p_decision: "underpaid", p_amount_due: 5 }));
    await waitFor(() => expect(fixtures.current.fnCalls.find((c) => c.name === "send-payment-email")?.body).toEqual({ kind: "payment_underpaid", payment_id: "p1" }));
  });

  it("My registrations and My ticket ask only for the signed-in user's own rows, even for an admin (who may read everyone's)", async () => {
    asUser(true);                                                                       // an ADMIN account: the database would let it read every registration
    fixtures.current.registrations = [{ ...reg, id: "mine" }, { ...reg, id: "theirs", user_id: "someone-else", name: "Someone Else", ticket_number: "IVEMON-000999" }];
    let r = page("/my-registrations", <MyRegistrations />);
    await screen.findAllByText("Juan Dela Cruz", { exact: false });
    expect(fixtures.current.eqs.filter((q) => q.table === "registrations")).toContainEqual({ table: "registrations", col: "user_id", val: "u1" });
    r.unmount();
    fixtures.current.eqs = [];
    r = page("/my-ticket/:id", <MyTicket />, "/my-ticket/mine");
    await screen.findByRole("heading", { level: 1, name: "My ticket" });
    await waitFor(() => expect(fixtures.current.eqs).toContainEqual({ table: "registrations", col: "user_id", val: "u1" }));
    expect(fixtures.current.eqs).toContainEqual({ table: "registrations", col: "id", val: "mine" });
  });

  it("My registrations: statuses, and an underpaid payment can be fixed from a dialog", async () => {
    asUser();
    fixtures.current.registrations = [
      { ...reg, id: "ra", status: "confirmed" },
      { ...reg, id: "rb", name: "Maria Santos", ticket_number: null, status: "pending_verification", payment_id: "pb", payments: { id: "pb", status: "underpaid", review_note: "Transaction fee deducted", amount_due: 5, amount_paid: 95, reference_number: "999", sender_name: "Maria S." } },
      { ...reg, id: "rc", name: "Pedro Reyes", ticket_number: null, status: "rejected", payment_id: "pc", payments: { id: "pc", status: "rejected", review_note: "Wrong reference number", amount_due: null, amount_paid: 100, reference_number: "888", sender_name: "Pedro R." } },
      { ...reg, id: "rd", name: "Ana Cruz", ticket_number: null, status: "pending_verification", payment_id: "pd", payments: { id: "pd", status: "pending", review_note: null, amount_due: null, amount_paid: 100, reference_number: "777", sender_name: "Ana C." } },
    ];
    fixtures.current.rpc = { resubmit_payment: { payment_id: "pb", status: "pending" } };
    const user = userEvent.setup({ applyAccept: false });
    const { container } = page("/my-registrations", <MyRegistrations />);
    await screen.findAllByText("Maria Santos", { exact: false });
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("Pending verification").length).toBe(2);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View ticket/ })).toHaveLength(1);      // a ticket and QR only when confirmed
    expect(screen.getByText(/Payment incomplete: ₱5.00 still due/)).toBeInTheDocument();
    expect(screen.getByText("Wrong reference number")).toBeInTheDocument();
    expect(screen.getByText(/being verified/)).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: /Send the missing amount for Maria Santos/ }));
    const dialog = screen.getByRole("dialog", { name: "Send the missing amount" });
    expect(within(dialog).getByText(/total you have paid/)).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));
    expect(await within(dialog).findByRole("alert", { name: /problems/ })).toBeInTheDocument();   // nothing filled in yet
    await user.type(within(dialog).getByLabelText(/^Total Amount Paid/), "100");
    await user.type(within(dialog).getByLabelText(/^Reference Number/), "9990001112223");
    await user.upload(dialog.querySelector("#resub-receipt"), new File(["r"], "r.pdf", { type: "application/pdf" }));
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));
    await waitFor(() => expect(fixtures.current.rpcCalls.find((c) => c.name === "resubmit_payment")?.args).toMatchObject({ p_payment_id: "pb", p_amount: 100, p_reference: "9990001112223" }));
    expect(fixtures.current.rpcCalls.find((c) => c.name === "resubmit_payment").args.p_receipt_path).toMatch(/^u1\/[0-9a-f-]{36}\.pdf$/);
  });

  it("Events: the editor has a Kits tab", async () => {
    asUser(true);
    fixtures.current.event_kits = [{ ...kitA }];
    const user = userEvent.setup();
    const { container } = admin(<Events />); await settled("Events");
    await user.click(screen.getByRole("button", { name: /Edit IVEMON: ODD PLATINUM/ }));
    const dialog = screen.getByRole("dialog", { name: "Edit event" });
    expect(within(dialog).getByLabelText(/Registration fee \(PHP\)/)).toHaveAccessibleDescription(/Used only when the event has no kits/);
    await user.click(within(dialog).getByRole("tab", { name: "Kits" }));
    expect(await within(dialog).findByDisplayValue("Standard kit")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add a kit" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });

  it("Dashboard: kits ordered, by kit, confirmed and pending", async () => {
    asUser(true);
    fixtures.current.registrations = [
      { id: "a", status: "confirmed", created_at: future, checked_in_at: null, kit_name: "Standard kit", kit_quantity: 2 },
      { id: "b", status: "confirmed", created_at: future, checked_in_at: null, kit_name: "Standard kit", kit_quantity: 1 },
      { id: "c", status: "pending_verification", created_at: future, checked_in_at: null, kit_name: "Standard kit", kit_quantity: 3 },
      { id: "d", status: "pending_verification", created_at: future, checked_in_at: null, kit_name: "Deluxe kit", kit_quantity: 2 },
      { id: "e", status: "rejected", created_at: future, checked_in_at: null, kit_name: "Deluxe kit", kit_quantity: 9 },
    ];
    const { container } = admin(<Dashboard />); await settled("Dashboard");
    const table = await screen.findByRole("table", { name: /Kits ordered/ });
    const rows = within(table).getAllByRole("row").slice(1).map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([["Deluxe kit", "0", "2", "2"], ["Standard kit", "3", "3", "6"]]);   // rejected orders are not counted
    expect(await check(container)).toHaveNoViolations();
  });

  it("Attendees: kit, quantity and total columns", async () => {
    asUser(true);
    fixtures.current.registrations = [{ ...reg, kit_name: "Deluxe kit", kit_quantity: 2, kit_unit_price: 250.5, total_amount: 501 }];
    const user = userEvent.setup();
    admin(<Attendees />); await settled("Attendees");
    await screen.findByRole("table", { name: /Attendees/ });
    expect(screen.getByRole("columnheader", { name: /Kit/ })).toBeInTheDocument();
    expect(screen.getByText("Deluxe kit × 2")).toBeInTheDocument();
    expect(screen.getByText("₱501.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View Juan Dela Cruz/ }));
    expect(within(screen.getByRole("dialog")).getByText("Deluxe kit × 2 at ₱250.50")).toBeInTheDocument();
  });

  it("Scanner: the kit and quantity are shown (and announced) so the right kit is handed over", async () => {
    fixtures.current.rpc = { check_in_attendee: { result: "success", name: "Juan Dela Cruz", x_username: "juan", ticket_number: "IVEMONOP-000001", registration_id: "r1", kit_name: "Deluxe kit", kit_quantity: 2, kit_claimed: false, receipt_verified: false } };
    const user = userEvent.setup();
    const { container } = admin(<Scanner />); await settled("QR Scanner");
    await user.type(screen.getByLabelText("Ticket number"), "ivemonop-000001{enter}");
    await screen.findByRole("heading", { name: "Valid ticket" });
    expect(screen.getByText("Kit: Deluxe kit × 2")).toBeInTheDocument();
    expect(container.querySelector('[aria-live="assertive"]')).toHaveTextContent("Kit: Deluxe kit, quantity 2.");
    expect(await check(container)).toHaveNoViolations();
  });

  it("Payments: the expected amount is the total of the ordered kits, and each form shows its kit", async () => {
    asUser(true);
    fixtures.current.payments = [payment({ amount_paid: 400, registrations: [
      { id: "r1", name: "Juan Dela Cruz", x_username: "juan", facebook_url: null, status: "pending_verification", ticket_number: null, kit_name: "Standard kit", kit_quantity: 2, total_amount: 200 },
      { id: "r2", name: "Maria Santos", x_username: "maria", facebook_url: null, status: "pending_verification", ticket_number: null, kit_name: "Deluxe kit", kit_quantity: 1, total_amount: 250.5 }] })];
    const user = userEvent.setup();
    const { container } = admin(<Payments />); await settled("Payments");
    expect(await screen.findByText(/₱400.00 \/ ₱450.50 \(short\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Review payment of Juan D./ }));
    const dialog = screen.getByRole("dialog", { name: /Payment of ₱400.00/ });
    expect(within(dialog).getByText("Expected (2 forms)")).toBeInTheDocument();
    expect(within(dialog).getByText("₱450.50")).toBeInTheDocument();
    expect(within(dialog).getByText("Standard kit × 2 = ₱200.00")).toBeInTheDocument();
    expect(within(dialog).getByText("Deluxe kit × 1 = ₱250.50")).toBeInTheDocument();
    expect(within(dialog).getByText(/lower than expected \(₱450.50\)/)).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });

  it("My registrations: the order is shown, and the resubmit minimum is the forms' total", async () => {
    asUser();
    fixtures.current.registrations = [
      { ...reg, id: "a", ticket_number: null, status: "pending_verification", kit_name: "Standard kit", kit_quantity: 2, total_amount: 200, payment_id: "pb", payments: { id: "pb", status: "underpaid", review_note: "Short", amount_due: 5, amount_paid: 195, reference_number: "999", sender_name: "Maria S." } },
      { ...reg, id: "b", name: "Pedro", ticket_number: null, status: "pending_verification", kit_name: "Deluxe kit", kit_quantity: 1, total_amount: 250.5, payment_id: "pb", payments: { id: "pb", status: "underpaid", review_note: "Short", amount_due: 5, amount_paid: 195, reference_number: "999", sender_name: "Maria S." } },
    ];
    const user = userEvent.setup();
    page("/my-registrations", <MyRegistrations />);
    expect(await screen.findByText("Standard kit × 2 · ₱200.00")).toBeInTheDocument();
    expect(screen.getByText("Deluxe kit × 1 · ₱250.50")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Send the missing amount/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "Send the missing amount" });
    expect(within(dialog).getByText(/at least ₱450.50, what the forms on this payment add up to/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Total Amount Paid/), "300");
    await user.type(within(dialog).getByLabelText(/^Reference Number/), "9990001112223");
    await user.upload(dialog.querySelector("#resub-receipt"), new File(["r"], "r.png", { type: "image/png" }));
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));
    expect((await within(dialog).findAllByText(/at least 450.50 PHP/)).length).toBeGreaterThan(0);
  });

  it("Attendees (table and detail dialog)", async () => {
    const user = userEvent.setup();
    const { container } = admin(<Attendees />); await settled("Attendees");
    await screen.findByRole("table", { name: /Attendees/ });
    expect(await check(container)).toHaveNoViolations();
    expect(screen.getByText(/attendees? found/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View Juan Dela Cruz/ }));
    expect(screen.getByRole("dialog", { name: "Juan Dela Cruz" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
  it("Scanner: camera controls, live region and manual alternative", async () => {
    const { container } = admin(<Scanner />); await settled("QR Scanner");
    expect(screen.getByRole("button", { name: "Start camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sound and vibration/ })).toHaveAttribute("aria-pressed");
    expect(screen.getByLabelText("Ticket number")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
  it("Scanner: a scan result is announced in an assertive live region", async () => {
    fixtures.current.rpc = { check_in_attendee: { result: "success", name: "Juan Dela Cruz", x_username: "juan", ticket_number: "IVEMON-000001", registration_id: "r1", kit_claimed: false, receipt_verified: false } };
    const user = userEvent.setup();
    const { container } = admin(<Scanner />); await settled("QR Scanner");
    await user.type(screen.getByLabelText("Ticket number"), "ivemon-000001{enter}");
    await screen.findByRole("heading", { name: "Valid ticket" });
    const live = container.querySelector('[aria-live="assertive"]');
    expect(live).toHaveTextContent("Valid ticket. Juan Dela Cruz, X username juan, ticket IVEMON-000001. Checked in.");
    expect(await check(container)).toHaveNoViolations();
  });
  it("Tracker (list and audit log)", async () => {
    const user = userEvent.setup();
    const { container } = admin(<Tracker />); await settled(/Attendance/);
    await screen.findByRole("table", { name: /Attendance list/ });
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("tab", { name: "Scan audit log" }));
    await screen.findByRole("table", { name: /Scan audit log/ });
    expect(await check(container)).toHaveNoViolations();
  });
  it("EmailTemplates: bold, italic and underline buttons and shortcuts format the HTML body", async () => {
    const user = userEvent.setup();
    const { container } = admin(<EmailTemplates />); await settled("Email");
    const body = await screen.findByLabelText("HTML body");
    expect(screen.getByRole("toolbar", { name: /Text formatting/ })).toBeInTheDocument();
    body.focus(); body.setSelectionRange(0, 0);
    await user.click(screen.getByRole("button", { name: /^Underline/ }));
    expect(body.value).toContain("<u>underlined text</u>");
    await new Promise((r) => requestAnimationFrame(() => r())); // the editor re-selects the inserted text
    await user.click(screen.getByRole("button", { name: /^Underline/ }));
    expect(body.value).not.toContain("<u>");
    await user.click(screen.getByRole("button", { name: /^Bold/ }));
    expect(body.value).toContain("<strong>bold text</strong>");
    body.focus();
    await user.keyboard("{Control>}i{/Control}");
    expect(body.value).toContain("<em>");
    expect(await check(container)).toHaveNoViolations();
  });
  it("EmailTemplates (template, bulk, logs)", async () => {
    const user = userEvent.setup();
    const { container } = admin(<EmailTemplates />); await settled("Email");
    await screen.findByLabelText("Subject");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("tab", { name: "Bulk mail merge" })); await screen.findByLabelText("Recipients");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("tab", { name: "Email logs" })); await screen.findByRole("table", { name: /Email logs/ });
    expect(await check(container)).toHaveNoViolations();
  });
  it("ChangeLog", async () => {
    const { container } = admin(<ChangeLog />); await settled("Change log");
    await screen.findByRole("table", { name: /Change log/ });
    expect(screen.getByText(/status: pending → verified/)).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
  it("Users", async () => { asUser(true); const { container } = admin(<Users />); await settled("Admin users"); await screen.findByRole("table", { name: /Admin users/ }); expect(await check(container)).toHaveNoViolations(); });
});
