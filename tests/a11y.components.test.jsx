// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { check } from "./helpers/a11y.js";

vi.mock("../src/lib/supabaseClient.js", async () => import("./helpers/mockSupabase.js"));
vi.mock("../src/context/AuthContext.jsx", async () => { const m = await import("./helpers/mockSupabase.js"); return { useAuth: () => m.authState.current }; });

import EventCard from "../src/components/EventCard.jsx";
import Modal from "../src/components/Modal.jsx";
import { ToastProvider, useToast } from "../src/components/Toast.jsx";
import DataTable from "../src/components/DataTable.jsx";
import TermsBox from "../src/components/TermsBox.jsx";
import TicketQr from "../src/components/TicketQr.jsx";
import TicketCard from "../src/components/TicketCard.jsx";
import Badge from "../src/components/Badge.jsx";
import Alert from "../src/components/Alert.jsx";
import Field from "../src/components/Field.jsx";
import ErrorSummary, { useErrorFocus } from "../src/components/ErrorSummary.jsx";
import PasswordInput from "../src/components/PasswordInput.jsx";
import AvailabilityBar from "../src/components/AvailabilityBar.jsx";
import AttendeeLayout from "../src/layouts/AttendeeLayout.jsx";
import AdminLayout from "../src/layouts/AdminLayout.jsx";
import { LiveRegionProvider, titleFor } from "../src/a11y.jsx";
import EventImage from "../src/components/EventImage.jsx";
import FileUpload from "../src/components/FileUpload.jsx";
import CopyButton from "../src/components/CopyButton.jsx";
import Stepper from "../src/components/Stepper.jsx";
import SafeHtml from "../src/components/SafeHtml.jsx";
import ConfirmDialog from "../src/components/ConfirmDialog.jsx";
import TermsEditor from "../src/components/TermsEditor.jsx";
import EventHeader from "../src/components/EventHeader.jsx";
import { asGuest, asUser } from "./helpers/mockSupabase.js";

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const ev = { id: "e1", title: "IVEMON Cupsleeve Event", subtitle: "Hosted by Teenfresh", event_date: future, ends_at: future, registration_deadline: future, registration_fee: 100, fee_note: "exclusive of food and drinks", venue: "Cafe", venue_address: "6 Yale St., Cubao", price_info: "Free", capacity: 100, registration_open: true, hashtags: ["#IVEMON_OP"], terms_html: "<p>Please read.</p><ol><li>Rule one</li><li>Rule two</li></ol>" };
const wrap = (ui) => render(<MemoryRouter><LiveRegionProvider><ToastProvider>{ui}</ToastProvider></LiveRegionProvider></MemoryRouter>);

describe("shared components have no axe violations", () => {
  it("EventCard: available, few slots, sold out, closed", async () => {
    const { container } = wrap(<ul>{[0, 95, 100, 40].map((n, i) => <li key={i}><EventCard event={{ ...ev, id: "e" + i, registration_open: i !== 3 }} registered={n} /></li>)}</ul>);
    expect(await check(container)).toHaveNoViolations();
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: "Register for IVEMON Cupsleeve Event" })).toHaveLength(2);
    expect(screen.getByText("100 of 100 slots left")).toBeInTheDocument();
    // sold-out button is aria-disabled with an adjacent explanation, never colour alone
    const disabled = screen.getAllByRole("button", { name: "Register" });
    expect(disabled[0]).toHaveAttribute("aria-disabled", "true");
    expect(disabled[0]).toHaveAccessibleDescription(/all slots are taken/i);
  });

  it("badges and alerts always carry text", async () => {
    const { container } = wrap(<div><Badge tone="ok">Available</Badge><Badge tone="warn">Few slots left</Badge><Badge tone="bad">Sold out</Badge><Alert tone="bad">Problem</Alert><Alert tone="ok">Saved</Alert></div>);
    expect(await check(container)).toHaveNoViolations();
  });

  it("Modal: labelled dialog, focus moves in, Esc closes, focus returns", async () => {
    const user = userEvent.setup();
    function Host() { const [open, setOpen] = React.useState(false); return <><button onClick={() => setOpen(true)}>Open</button>{open && <Modal title="Edit person" onClose={() => setOpen(false)}><label>Name<input /></label></Modal>}</>; }
    const { container } = wrap(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Edit person" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(await check(container)).toHaveNoViolations();
    await user.tab(); await user.tab(); await user.tab();       // focus trap: tabbing never leaves the dialog
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("Toast: errors stay until dismissed and are announced as alerts", async () => {
    const user = userEvent.setup();
    function Host() { const toast = useToast(); return <><button onClick={() => toast("Could not save", "error")}>Fail</button><button onClick={() => toast("Saved", "success")}>Ok</button></>; }
    const { container } = wrap(<Host />);
    await user.click(screen.getByText("Fail")); await user.click(screen.getByText("Ok"));
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toContain("Error: Could not save");
    expect(screen.getAllByRole("status").map((a) => a.textContent).join(" ")).toContain("Success: Saved");
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getAllByRole("button", { name: "Dismiss notification" })[0]);
    expect(screen.queryByText(/Could not save/)).toBeNull();
  });

  it("DataTable: caption, scoped headers, aria-sort, labelled scroll region, pagination nav", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, name: "Person " + String(i).padStart(2, "0"), n: i }));
    const { container } = wrap(<DataTable caption="Attendees" columns={[{ key: "name", label: "Name" }, { key: "n", label: "Number" }]} rows={rows} pageSize={10} />);
    expect(await check(container)).toHaveNoViolations();
    expect(screen.getByRole("table", { name: /Attendees/ })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "none");
    await user.click(screen.getByRole("button", { name: /Number/ }));
    expect(screen.getByRole("columnheader", { name: /Number/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("region", { name: "Attendees (scrollable)" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("navigation", { name: "Attendees pagination" })).toBeInTheDocument();
  });

  it("TermsBox is a real button with aria-expanded", async () => {
    const user = userEvent.setup();
    const { container } = wrap(<TermsBox event={ev} />);
    const btn = screen.getByRole("button", { name: /Terms and Conditions/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Rule one")).toBeVisible();
    expect(await check(container)).toHaveNoViolations();
  });

  it("QR ticket exposes the ticket number as text", async () => {
    const { container } = wrap(<><TicketQr ticketNumber="IVEMON-000123" /><TicketCard registration={{ name: "Juan", x_username: "juan", ticket_number: "IVEMON-000123", status: "confirmed" }} event={ev} /></>);
    expect(await check(container)).toHaveNoViolations();
    expect(screen.getAllByRole("img", { name: /IVEMON-000123/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("IVEMON-000123").length).toBeGreaterThan(0);
  });

  it("AvailabilityBar has progressbar semantics", async () => {
    const { container } = wrap(<AvailabilityBar registered={12} capacity={100} label="Slots taken" />);
    const bar = screen.getByRole("progressbar", { name: "Slots taken" });
    expect(bar).toHaveAttribute("aria-valuenow", "12");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(await check(container)).toHaveNoViolations();
  });

  it("Field + ErrorSummary link errors to inputs (3.3.1 / 3.3.2); the summary appears and takes focus only after a failed submit", async () => {
    const user = userEvent.setup();
    function Host() {
      const [signal, bump] = useErrorFocus();
      const [show, setShow] = React.useState(false);
      return <form onSubmit={(e) => e.preventDefault()}>
        <ErrorSummary errors={{ email: { message: "Enter a valid email" } }} labels={{ email: "Email" }} focusSignal={signal} />
        <Field id="email" label="Email" required error="Enter a valid email" hint="We email your ticket"><input type="email" autoComplete="email" /></Field>
        <Field id="pw" label="Password" required><PasswordInput autoComplete="new-password" /></Field>
        <button type="button" onClick={() => { setShow(true); bump(); }}>Submit</button>{show && null}
      </form>;
    }
    const { container } = wrap(<Host />);
    expect(screen.queryByRole("alert", { name: /problem/ })).toBeNull();                       // errors alone do not show the summary
    const input = screen.getByLabelText(/Email \(required\)/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription(/Enter a valid email/);
    await user.click(screen.getByRole("button", { name: "Submit" }));                          // a failed submit
    const summary = await screen.findByRole("alert", { name: /1 problem/ });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(summary).toHaveTextContent("Email: Enter a valid email");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
    expect(await check(container)).toHaveNoViolations();
  });

  it("AttendeeLayout: skip link first, landmarks, current page marked", async () => {
    asUser(true);
    const { container } = render(<MemoryRouter initialEntries={["/"]}><LiveRegionProvider><Routes><Route element={<AttendeeLayout />}><Route index element={<h1>Upcoming events</h1>} /></Route></Routes></LiveRegionProvider></MemoryRouter>);
    expect(await check(container)).toHaveNoViolations();
    const focusables = container.querySelectorAll("a,button");
    expect(focusables[0]).toHaveTextContent("Skip to main content");
    expect(focusables[0]).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events", current: "page" })).toBeInTheDocument();
    asGuest();
  });

  it("AdminLayout (phone): one Admin landmark, five tabs in visual order, the active tab is aria-current", async () => {
    asUser(true);
    // jsdom has no CSS: apply the two rules that decide the layout below 1024px (sidebar hidden)
    const style = document.createElement("style"); style.textContent = ".hidden{display:none}"; document.head.appendChild(style);
    const { container } = render(<MemoryRouter initialEntries={["/admin"]}><LiveRegionProvider><Routes><Route path="/admin" element={<AdminLayout />}><Route index element={<h1>Dashboard</h1>} /></Route></Routes></LiveRegionProvider></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    const nav = screen.getByRole("navigation", { name: "Admin" });
    const tabs = within(nav).getAllByRole("link").map((a) => a.getAttribute("aria-label") || a.textContent.trim());
    expect(tabs).toEqual(["Home", "Search", "Scan QR code", "History", "Profile"]);
    expect(within(nav).getByRole("link", { name: "Home", current: "page" })).toBeInTheDocument();
    expect(within(nav).getAllByRole("link", { current: "page" })).toHaveLength(1);
    style.remove();
    asGuest();
  });
});

describe("images, uploads and the new form pieces", () => {
  it("EventImage: a placeholder reserves the aspect ratio, never looks broken, and offers admins an upload", async () => {
    asGuest();
    const { container, unmount } = wrap(<><EventImage slot="poster" event={ev} /><EventImage slot="gcash_qr" event={ev} /><EventImage slot="banner" event={ev} /><EventImage slot="email_banner" event={ev} /></>);
    const boxes = [...container.querySelectorAll("[data-placeholder]")];
    expect(boxes.map((b) => b.style.aspectRatio)).toEqual(["3 / 4", "8 / 15", "16 / 9", "4 / 1"]);
    expect(screen.getByText("Event poster image coming soon")).toBeInTheDocument();
    expect(screen.queryByText(/Upload image/)).toBeNull();                                   // visitors never see the upload button
    expect(await check(container)).toHaveNoViolations();
    unmount();
    asUser(true);
    const admin = wrap(<EventImage slot="poster" event={ev} />);
    expect(screen.getByText(/Recommended: 3:4 portrait, 1200 x 1600 px/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Upload image/)).toHaveAttribute("type", "file");
    expect(await check(admin.container)).toHaveNoViolations();
    asGuest();
  });

  it("EventImage: shows the image with alt text, falls back to the placeholder on a load error, and opens an accessible lightbox", async () => {
    const user = userEvent.setup();
    const { container } = wrap(<EventImage slot="poster" event={ev} image={{ id: "i1", slot: "poster", storage_path: "e1/poster.png", alt_text: "Poster with the event details" }} />);
    const img = screen.getByAltText("Poster with the event details");
    expect(img).toHaveAttribute("src", "https://storage.test/event-media/e1/poster.png");
    expect(img).toHaveAttribute("width", "1200"); expect(img).toHaveAttribute("height", "1600"); expect(img).toHaveAttribute("loading", "lazy");
    expect(await check(container)).toHaveNoViolations();
    const opener = screen.getByRole("button", { name: /View larger: Poster with the event details/ });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Event poster" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("link", { name: "Download image" })).toHaveAttribute("download");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    img.dispatchEvent(new Event("error"));                                                    // a broken URL
    expect(await screen.findByText("Event poster image coming soon")).toBeInTheDocument();
  });

  it("FileUpload: keyboard accessible, announces the file, validates type and size, and can remove it", async () => {
    const user = userEvent.setup({ applyAccept: false });   // browsers let people pick "All files" past the accept filter, so the code must check too
    function Host() { const [f, setF] = React.useState(null); return <FileUpload id="receipt" file={f} onChange={setF} />; }
    const { container } = wrap(<Host />);
    const input = container.querySelector("#receipt");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.className).toContain("sr-only");                                              // visually hidden but still focusable
    expect(screen.getByText("No file yet.")).toBeInTheDocument();
    await user.upload(input, new File(["x"], "evil.exe", { type: "application/octet-stream" }));
    expect(await screen.findByText(/file type is not allowed/)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.upload(input, new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" }));
    expect((await screen.findAllByText(/limit is 5 MB/)).length).toBeGreaterThan(0);   // shown in the field and echoed to the live region
    await user.upload(input, new File(["receipt"], "gcash.png", { type: "image/png" }));
    expect((await screen.findAllByText("gcash.png")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByRole("status").map((n) => n.textContent).join(" ")).toContain("Selected gcash.png"));   // announced
    expect(screen.getByAltText("Preview of your receipt")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Remove gcash.png" }));
    expect(screen.getByText("No file yet.")).toBeInTheDocument();
  });

  it("CopyButton copies and announces it in a live region", async () => {
    const user = userEvent.setup();
    const writes = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => writes.push(t) }, configurable: true });
    const { container } = wrap(<CopyButton text="09171234567" />);
    await user.click(screen.getByRole("button", { name: "Copy number" }));
    expect(writes).toEqual(["09171234567"]);
    expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("status").map((n) => n.textContent).join(" ")).toContain("GCash number copied to the clipboard"));
    expect(await check(container)).toHaveNoViolations();
  });

  it("Stepper: a labelled ordered list with aria-current=step", async () => {
    const steps = [{ key: "a", label: "Event info and terms" }, { key: "b", label: "Participant's information" }, { key: "c", label: "Payment" }, { key: "d", label: "Review and submit" }];
    const { container } = wrap(<Stepper steps={steps} current={1} />);
    expect(screen.getByRole("navigation", { name: "Registration progress" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.getAttribute("aria-current"))).toEqual([null, "step", null, null]);
    expect(items[0]).toHaveTextContent("(completed)"); expect(items[2]).toHaveTextContent("(upcoming)");
    expect(await check(container)).toHaveNoViolations();
  });

  it("SafeHtml renders formatting but never scripts, handlers or javascript: links", async () => {
    const { container } = wrap(<SafeHtml html={'<p>Hi <strong>there</strong></p><script>window.hacked=1</script><img src=x onerror="window.hacked=1"><a href="javascript:alert(1)" onclick="x()">bad</a><a href="https://x.com/TeenfreshPH">ok</a><ol><li>One</li></ol>'} />);
    expect(container.querySelector("strong")).toHaveTextContent("there");
    expect(container.querySelector("script,img")).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:|onclick|onerror/);
    expect(screen.getByRole("link", { name: "ok" })).toHaveAttribute("href", "https://x.com/TeenfreshPH");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });

  it("ConfirmDialog focuses in, Esc cancels, and only the top of stacked dialogs reacts", async () => {
    const user = userEvent.setup();
    const calls = [];
    const { container } = wrap(<Modal title="Outer" onClose={() => calls.push("outer")}><ConfirmDialog title="Sure?" onCancel={() => calls.push("inner")} onConfirm={() => {}}>Really?</ConfirmDialog></Modal>);
    expect(screen.getByRole("dialog", { name: "Sure?" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["inner"]);                                                         // the outer dialog stays
  });

  it("TermsEditor: plain text in, formatted preview out", async () => {
    const user = userEvent.setup();
    function Host() { const [v, setV] = React.useState('Hello <script>alert(1)</script>'); return <><label htmlFor="t">Terms</label><TermsEditor id="t" value={v} onChange={setV} /></>; }
    const { container } = wrap(<Host />);
    expect(container.querySelector(".safe-html script")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Numbered list" }));
    expect(screen.getByLabelText("Terms").value).toMatch(/^1\. /);
    expect(container.querySelector(".safe-html ol")).not.toBeNull();
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });

  it("EventHeader shows the facts as real text, with a maps link", async () => {
    const { container } = wrap(<EventHeader event={ev} st={{ canRegister: true, slotsLeft: 7 }} />);
    expect(screen.getByText("1 Form = 1 Entry")).toBeInTheDocument();
    expect(screen.getByText(/LIMITED SLOTS ONLY/)).toBeInTheDocument();
    expect(screen.getByText("* Indicates required question")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute("href", expect.stringContaining("google.com/maps/search"));
    expect(screen.getByText("₱100.00 (exclusive of food and drinks)")).toBeInTheDocument();
    expect(await check(container)).toHaveNoViolations();
  });
});

describe("route titles", () => {
  it("every route has a unique, descriptive title", () => {
    const paths = ["/", "/events/1/register", "/my-registrations", "/my-ticket/1", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback", "/admin", "/admin/events", "/admin/payments", "/admin/attendees", "/admin/scanner", "/admin/tracker", "/admin/emails", "/admin/users"];
    const titles = paths.map(titleFor);
    expect(new Set(titles).size).toBe(paths.length);
    expect(titleFor("/nope")).toBe("Page not found");
  });
});
