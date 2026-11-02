# Changelog

All notable changes to the Teenfresh event registration and attendance system.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is [SemVer](https://semver.org/):
`1.0.0` is the first release and covers everything from the initial commit up to commit `5024be1`. `1.1.0` adds Excel reports and fixes typing in dialogs. `1.2.0` makes underpayments top-ups. `1.2.1` tidies the public footer. `1.3.0` makes one form equal one kit. `1.4.0` lets people type the reference number freely. `1.4.1` shows My registrations as event-style cards and recolours the mobile admin bar.

## [1.4.1] - 2026-11-02

### Changed
- **My registrations is now a grid of cards**, the same card as the events on the home page (1 column on phones, 2 on tablets, 3 on desktop), instead of full-width horizontal rows. Each card shows the event banner, the title and status, then Date, Venue, For, Kit and Ticket with icons. "View ticket" (confirmed) or the payment action (underpaid or rejected) sits at the bottom of the card at full width.
- **The admin bottom bar on mobile is cream**, the same colour as the desktop sidebar and the top bar (it was dark). The current page is an ink pill with ivory text, like the sidebar; the scan button keeps its blue fill with an ink outline. Contrast pairings in `scripts/contrast.js` were updated.

## [1.4.0] - 2026-11-02

### Changed
- **The reference number is free text.** People can type it exactly as their banking app shows it: letters, digits and hyphens, 1 to 64 characters. Before, only 8 to 20 digits were accepted and hyphens were removed. Spaces are still removed. The same reference still cannot be used twice for one event.
- The field uses the normal keyboard (it was the number pad), with a hint "Type it exactly as your banking app shows it". This applies to the registration form and to resubmitting a payment.

### Removed
- The "digits only, 8 to 20" rule in the form, the database and the error message, and the warning that GCash references are usually 13 digits.

### Upgrade notes
- Run `supabase/migrations/007_free_reference_number.sql` in the SQL Editor of project `fnhamldmvpdcygjbzdls`. Until it runs, the database still refuses references that are not 8 to 20 digits. Saved payments are not changed.

## [1.3.0] - 2026-11-02

### Changed
- **One form = one kit.** The registration form no longer asks for a quantity. The attendee picks a kit and pays that kit's price; the step is now called **Kit** (was "Kit and quantity"). To order more kits, an attendee fills in another form, as with any other entry.
- The total reads "Total to pay: ₱250.50" and the amount hint names the kit instead of "2 × price".
- The event page lists kits as "Name: price" (the "up to N per form" text is gone).
- Admin pages, the scanner and emails show the kit name alone; "× N" appears only on older orders placed before this change that have more than one.

### Removed
- The Quantity field with its plus and minus buttons from the registration form, and the "Most one form can order" field from the Kits tab.

### Upgrade notes
- Run `supabase/migrations/006_one_kit_per_form.sql` in the SQL Editor of project `fnhamldmvpdcygjbzdls`. It sets every kit to one per form so the database refuses a quantity above 1 (it does not touch placed orders). The front end works without it, but the database only enforces the rule after it runs.

## [1.2.1] - 2026-11-02

### Removed
- The Teenfresh logo from the public footer (the header logo stays).
- The visible words "Facebook" and "X" in the footer social links.

### Changed
- The footer links now show only `/TeenfreshPH` and `@TeenfreshPH` beside their icons. "Facebook" and "X" remain in the link names for screen readers (hidden text), so the accessible names still contain the visible text.

## [1.2.0] - 2026-11-01

### Changed
- **Underpayment now means "send only what is missing".** When an admin marks a payment underpaid (for example 95 of 100, with 5 due), the attendee is asked for just the missing amount, not the full amount again. The Resubmit dialog says how much they have paid and how much is missing, prefills the amount, and accepts anything from the missing amount upward.
- The amount sent is **added** to what was paid before (95 + 5 = 100) before the admin verifies. A **rejected** payment still needs a full payment for the forms, and replaces the old amount as before.
- The underpaid email says to send only the remaining amount (`PHP {{Amount Due}}`) and that the full amount does not need to be paid again. Existing events get the new wording automatically; a template you rewrote yourself is left alone.

### Added
- `payments.amount_history`: the earlier totals are kept (like the receipt and reference history), and the admin's payment review shows them as "Earlier totals".
- Migration `supabase/migrations/005_underpayment_top_up.sql` (run it before deploying this version).

### Fixed
- An underpaid attendee who lacked only a few pesos had to pay the full fee again.

## [1.1.0] - 2026-11-01

### Added
- Excel (.xlsx) reports: **Attendees**, **Payments** and **Attendance** now export as real Excel workbooks. The header row is bold on the Teenfresh ink colour, frozen, and has filters; columns are sized to their content; amounts stay numbers. Cells are written as typed values and never as formulas, so a name such as `=HYPERLINK(...)` cannot run in Excel. The Excel library is loaded only when someone exports.
- Tests: Excel file contents (`tests/excel.test.js`), real downloads of all three reports and the edit/transfer typing flow in a browser (`e2e/reports.spec.js`), and a regression test for the dialog focus bug (`tests/modal.test.jsx`).

### Changed
- Export buttons read **Export Excel** (was "Export CSV") and download `attendees-<prefix>.xlsx`, `payments-<prefix>.xlsx` and `attendance-<prefix>.xlsx`.
- If an export fails, a message explains it instead of failing silently.

### Fixed
- **Edit / transfer slot** (and every dialog with a form): only one character could be typed at a time. The dialog re-ran its setup on every keystroke because callers pass a new `onClose` function each render, which moved focus back to the first control. The dialog now sets up once and keeps the latest `onClose` in a reference. This also fixes the same problem in the event editor and other dialog forms.

### Removed
- CSV export from the Attendees, Payments and Attendance pages (replaced by Excel). `src/lib/csv.js` is no longer used by any page.

## [1.0.0] - 2026-11-01

First release. Live at https://teenfresh-events.web.app (Firebase Hosting, project `teenfresh-events`).

### Added

**Registration and tickets**
- Attendee site: event list (equal-size cards with availability bar), event page, sign up / sign in (email + Google), forgot and reset password.
- Multi-step registration form for IVEMON: ODD PLATINUM: event info and terms, participant details, payment (GCash receipt upload), review and submit. Draft is kept in session storage.
- One form = one entry per X username per event; one payment can cover several forms (balance-based sharing).
- Kit options: admins define kits (name, price per kit, max per order); attendees choose a kit and quantity and see a live total. Totals are computed in SQL.
- Payment verification by admins: verify, mark underpaid (with amount due) or reject (with reason). Tickets and confirmation emails are issued only on verification; pending forms hold their slots.
- Attendees can resubmit a rejected or underpaid payment from My registrations.
- Ticket page with QR code (payload is only the ticket number; the server looks it up). **The Teenfresh logo is in the middle of every QR code**, level H error correction, verified to scan.
- Five replaceable event images (poster, details card, GCash QR, banner, email banner) managed in the admin Media tab.
- Terms and conditions editor (sanitised rich text) shown on the registration page and in emails.

**Admin**
- Dashboard (key numbers, charts, kits ordered, recent check-ins), Events (details, kits, media), Payments, Attendees (filters, edit/transfer, cancel/restore, delete, CSV export), QR Scanner (camera + manual check-in + search, live announcements), Attendance tracker with scan audit log, Email templates, bulk mail merge and email logs, Admin users (promote/demote).
- **Change log**: append-only audit trail written by database triggers (who changed what, when). Contact details and payment references are recorded as "[changed]" without values. Admin read only.
- **Admin navigation**: bottom bar below 1024px (Home, Search, raised Scan button, History, Profile) with a docked state on the Scanner page, floating pill on tablets; collapsible sidebar from 1024px. New Profile page (account, Manage list, switch to attendee view, sign out) with a live pending-payments badge.
- Responsive admin pages: tables become cards below 768px and compact tables on tablets; filters collapse into a sheet on phones; dialogs are full-screen sheets on phones; payments review is a split view from 768px; scanner result slides up above the bar; sticky bottom Save areas.
- Email editor formatting toolbar (bold, italic, underline, link, paragraph) with Ctrl/Cmd+B/I/U.

**Email**
- Confirmation email in the exact Teenfresh format with merge fields (`{{Name}}`, `{{Ticket Number}}`, `{{Kit}}`, `{{Quantity}}`, `{{Total Amount}}`, `{{Terms}}`, `{{Contact Links}}`, `{{Banner}}`, `{{QR Code}}`, ...), payment emails (underpaid, rejected, acknowledgment), bulk mail and test sends.
- **The ticket QR code (with logo) is included in the confirmation email** for easy scanning at the event. It is hosted as a PNG in the public `event-media` bucket under an unguessable name (`qr/<registration id>.png`); templates without `{{QR Code}}` get it automatically above the Terms.
- Gmail SMTP (app password) provider alongside Resend, chosen with `MAIL_PROVIDER`.

**Design, accessibility and security**
- Teenfresh palette as surfaces only; ink / ink-muted / link / danger / success / warning-ink companion tokens for text. WCAG 2.2 AA throughout: skip link, route title and focus, live regions, error summary, 44px targets, visible focus ring, reduced-motion, forced-colors and high-contrast support. `scripts/check-contrast.js` fails the build if a token pairing breaks.
- Icons on navigation, every button, page headings, tabs, event details, dashboard tiles, empty states and editor toolbars (one outline set, decorative, text label always present).
- Footer social icons (Facebook, X, mail); Teenfresh logo everywhere.
- Security headers on Firebase Hosting: strict CSP (no inline script, no eval), HSTS, frame denial, nosniff, referrer and permissions policy. Row-level security everywhere; private receipt bucket with 5-minute signed URLs; receipt retention purge script.
- Tests: Vitest (PGlite runs the real migrations; component and page axe tests), Playwright with axe on every route, 320px reflow, CSP run against the production build, admin navigation at 8 phone/tablet and 5 desktop sizes, Lighthouse CI on public pages.
- Database migrations: `schema.sql`, `002_registration_payments.sql`, `003_kits.sql`, `004_change_log.sql`. Edge Functions: `send-confirmation-email`, `send-bulk-email`, `send-payment-email`.

### Changed
- Hosting moved from Vercel to Firebase Hosting (site `teenfresh-events`).
- Upgraded `zod` 3 to 4, `react-router-dom` 6 to 7 and `@hookform/resolvers` 3 to 5 (clears `npm audit` for production dependencies). Zod's JIT is switched off so the CSP can stay free of `eval`.
- Email signature logo and icons always load from the live site, so a stale `PUBLIC_SITE_URL` secret can no longer break them.
- Shared payments are matched by balance (amount paid minus linked forms' totals) instead of a flat fee; events without kits keep the flat fee.
- Page headings are fluid (24px to 32px); inputs are 16px and 44px tall on phones; admin content has per-breakpoint gutters and max widths.
- Dialogs: full-screen sheets below 768px, centred from 768px.
- Admin tables: rows render as cards below 768px; the payments review opens beside the list from 768px.

### Fixed
- Camera start crashed the admin page (`removeChild`) because html5-qrcode rewrote a React-managed element.
- Error summary stole focus after one typed character; it now appears only after a failed submit.
- Attendee **My registrations** and **My ticket** listed other users' rows for admins (RLS lets admins read everything); both now filter to the signed-in user.
- Upcoming event cards differed in height between rows.
- Confirmation template looked blank when the database had not been migrated; the editor now shows an explanatory error.
- Email signature looked unstyled in real mail (relative image URLs).

### Removed
- Vercel configuration (`vercel.json`) and the Vercel deployment target.
- The mobile "Menu" button and slide-down drawer in the admin area (replaced by the bottom bar and Profile page).
- Text glyphs used as icons: "✕", "▲/▼", "+" / "−" prefixes, the "←" in "Attendee site" (replaced by SVG icons).
- Modal-only payment review on screens 768px and wider (replaced by the split view; phones still get a sheet).
- The two-column email editor breakpoint at 1280px (now 1024px).

### Security
- Strict security headers and CSP added (see above). No service-role key in the browser or the repository; `.env` is not tracked.
- Change log redacts personal data; QR emails use unguessable file names.

### Upgrade notes
1. Run the migrations in order in the Supabase SQL Editor of project `fnhamldmvpdcygjbzdls`: `schema.sql`, `002`, `003`, `004`.
2. Deploy the Edge Functions: `supabase functions deploy send-confirmation-email send-bulk-email send-payment-email`.
3. Mail secrets (set in your own Terminal): `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_FROM_NAME`, and for Gmail `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; `PUBLIC_SITE_URL=https://teenfresh-events.web.app`.
4. Build and deploy the site: `npm run deploy`.

### Commit history
| Commit | Summary |
|---|---|
| `3b82069` | Initial commit (GitHub-created, license only) |
| `cf99b74` | Event registration and attendance app (attendee and admin views, QR tickets, scanner, email, payments, Teenfresh palette, WCAG 2.2) |
| `b0976ce` | Pin Vercel to the Vite build (later removed) |
| `d1afdc0` | Add security headers (CSP, framing, nosniff, referrer, permissions); fix scanner crash |
| `3ac4c86` | Switch hosting from Vercel to Firebase Hosting (`teenfresh-events`) |
| `10b7abe` | Add kit options, quantity and amount per kit to the registration form |
| `178c368` | My registrations and My ticket ask only for the signed-in user's own rows |
| `58b09f2` | Add decorative icons to attendee and admin navigation |
| `9ecd249` | Add admin Change log (audit trail via database triggers) |
| `5f8e419` | Add bold, italic, underline, link and paragraph formatting to the email HTML editor |
| `e045b8b` | Email signature: fall back to the public site URL |
| `de73371` | Email signature: always load logo and icons from the live site |
| `e569992` | Add consistent icons to all buttons |
| `76a54c0` | Upgrade zod 4, react-router 7, hookform resolvers 5; keep zod CSP-safe |
| `adbc9be` | Make upcoming event cards the same size |
| `ff7dea4` | Add the Teenfresh logo to every QR code; include the ticket QR code in the confirmation email |
| `8379ab7` | Add icons to page headings, tabs, event details, dashboard tiles, empty states and editor toolbars |
| `5024be1` | Admin: bottom navigation with raised scan button below 1024px, Profile page, responsive admin pages |
