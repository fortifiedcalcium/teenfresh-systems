# Changelog

All notable changes to the Teenfresh event registration and attendance system.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is [SemVer](https://semver.org/):
`1.0.0` is the first release and covers everything from the initial commit up to commit `5024be1`.

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
