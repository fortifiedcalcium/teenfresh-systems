# Event Registration & Attendance

React 18 + Vite + Tailwind front end, Supabase (Auth, Postgres, RLS, Realtime, Edge Functions) back end. Attendees fill in a 4-step form and pay by GCash with a receipt upload; an admin verifies the payment, which issues the ticket (QR code) and sends the confirmation email; admins scan tickets at the door and track attendance.

```
src/                     React app (attendee site + /admin)
supabase/migrations/schema.sql                  tables, RLS, triggers, RPCs, seed (IVEMON: BRILLIANT FORCE event)
supabase/migrations/002_registration_payments.sql   payments, receipts, image slots, storage buckets, ODD PLATINUM seed (run second)
supabase/migrations/003_kits.sql                    kit options, quantity and price per kit, balance-based shared payments (run third)
supabase/migrations/004_change_log.sql              admin Change log: who changed what (run fourth)
supabase/functions/send-confirmation-email   ticket email on verification / resend / test email
supabase/functions/send-payment-email        underpaid, rejected and "we received your registration" emails
supabase/functions/send-bulk-email           admin bulk mail merge
scripts/purge-receipts.mjs                   deletes payment receipts N days after an event (privacy)
supabase/functions/_shared/merge.ts          the mail-merge code (also used by the browser preview)
public/email, public/banners                 placeholder logo, icons and banner: replace with the real ones
```

## Accessibility
The app targets **WCAG 2.2 AA** with the Teenfresh palette (brand colours as surfaces, accessible companion tokens for text and borders). See [ACCESSIBILITY.md](ACCESSIBILITY.md) for the token ratios, deviations, and the manual test checklist.
`npm run check:contrast` runs before every build; `npm test`, `npm run lint`, `npm run test:e2e` (Playwright + axe) and `npm run lighthouse` cover the rest.

## 1. Create the Supabase project
1. https://supabase.com → **New project**. Note the **Project URL**, the **anon key** (Project Settings → API) and the **project ref**.
2. **SQL Editor** → paste all of `supabase/migrations/schema.sql` → **Run**.
3. **SQL Editor** → new query → paste all of `supabase/migrations/002_registration_payments.sql` → **Run**. Run it once, after the first file. It adds payments, receipt uploads, image slots, the two storage buckets (`event-media` public, `payment-receipts` private) and the *IVEMON: ODD PLATINUM* event. It keeps existing events and registrations (see the comments at the top of the file). If it stops with "registered more than once", two active registrations share an X username for the same event: cancel the extra one in Admin > Attendees and run it again.
4. **SQL Editor** → new query → paste all of `supabase/migrations/003_kits.sql` → **Run** (once, after the second file). It adds kit options, quantity and amount per kit. Existing registrations are kept as quantity 1 at the old fee.
5. **SQL Editor** → new query → paste all of `supabase/migrations/004_change_log.sql` → **Run** (once, after the third file). It adds **Admin → Change log**, filled by database triggers; contact details and payment references are logged as “changed” without their values.

## 2. Auth providers
**Authentication → Providers → Email**: enable, and keep **Confirm email** on (sign-up sends a verification link).

**Authentication → URL Configuration**
- *Site URL*: your production URL (e.g. `https://teenfresh-events.web.app`)
- *Redirect URLs*: add `http://localhost:5173/**` and `https://teenfresh-events.web.app/**`

**Google sign-in**
1. Google Cloud Console → *APIs & Services → OAuth consent screen* (configure) → *Credentials → Create credentials → OAuth client ID → Web application*.
2. **Authorized redirect URI**: `https://<PROJECT-REF>.supabase.co/auth/v1/callback` (exactly this; it is Supabase's callback, not your site).
3. Copy the Client ID and Client secret into Supabase → *Authentication → Providers → Google* → enable → save.

## 3. Run locally
```bash
cp .env.example .env      # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
npm test                  # schema/RLS (real Postgres via PGlite), email merge, contrast, vitest-axe on all pages
```
Camera scanning needs **HTTPS or localhost**; phones need the deployed HTTPS site.

## 4. Create the first admin
Sign up on the site once, then in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
Reload; an **Admin** link appears. Further admins can be promoted from **Admin → Admin users**.

## 5. Email (Edge Functions)
Install the CLI (`brew install supabase/tap/supabase`), then:
```bash
supabase login
supabase link --project-ref <PROJECT-REF>

supabase secrets set MAIL_PROVIDER=resend \
  RESEND_API_KEY=re_xxx \
  MAIL_FROM=tickets@your-verified-domain.com \
  MAIL_FROM_NAME=Teenfresh \
  MAIL_REPLY_TO=teenfreshph@gmail.com \
  PUBLIC_SITE_URL=https://teenfresh-events.web.app

supabase functions deploy send-confirmation-email
supabase functions deploy send-bulk-email
supabase functions deploy send-payment-email
```
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` and **`SUPABASE_SERVICE_ROLE_KEY` are injected into functions automatically.** The CLI refuses to set secrets that start with `SUPABASE_`, so you never handle the service-role key. It is never in the browser.
- **Resend:** verify your sending domain (Resend → Domains); `MAIL_FROM` must be on it.
- **Gmail/SMTP instead:** `MAIL_PROVIDER=smtp SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=you@gmail.com SMTP_PASS=<app password>` (Gmail free accounts allow roughly 100 to 500 emails/day).
- `PUBLIC_SITE_URL` turns relative image paths (`/banners/ivemon.png`, `/email/logo.png`) into absolute URLs, which email clients require. Without it, images will not load in emails.

## 6. Deploy to Firebase Hosting
The site is hosted on Firebase Hosting (project and site `teenfresh-events`, address https://teenfresh-events.web.app). The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your `.env` when it is built, so there is nothing to set in a dashboard.
```bash
firebase login                 # once
npm run deploy                 # builds (the contrast check runs first) and publishes to teenfresh-events
```
`firebase.json` serves `dist/`, sends every route to `index.html` (single-page app) and sets the security headers. Deploys are manual; to deploy on every push to GitHub, run `firebase init hosting:github` once (it adds a GitHub Actions workflow). A custom domain (for example `events.yourdomain.com`) is added under Firebase console > Hosting > Add custom domain.

## Security headers
`firebase.json` sends a strict Content-Security-Policy (scripts only from the site itself, no inline or eval scripts, connections only to your Supabase project, no framing), plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a `Permissions-Policy` that allows only this site to use the camera (for the QR scanner), HTTPS-only (HSTS), and long caching for the fingerprinted `assets/` (HTML is always revalidated so a new deploy shows up at once).
`npm run test:e2e` runs the production build with these exact headers enforced in a browser (`e2e/csp.spec.js`) and fails on any violation, including the camera scanner, the receipt viewer and the email preview. If you add a new external service (an analytics script, another image host, a payment widget), add its domain to the right directive in `firebase.json` first, or the browser will block it.

## Kits, quantity and price per kit
In **Admin > Events > edit > Kits** an event gets one or more kit options, each with a **name**, a **price per kit** (the amount per quantity), a short **description** and the **most one form may order**. In the registration form a new **Kit and quantity** step lets the attendee choose a kit and a quantity and shows the total (`quantity × price`); the payment step then asks for at least that amount.
- The database works out the total from the kit itself. The browser only sends *which* kit and *how many*, never a price, so it cannot be changed from the page.
- What was ordered (kit name, quantity, price per kit, total) is copied onto each registration, so changing a price later affects only new orders, and deleting a kit never rewrites old ones. A switched-off kit disappears from the form but stays on old orders.
- With **no kits**, an event keeps its single flat registration fee (quantity 1), exactly as before.
- The kit and quantity show on the Attendees page and CSV, the Payments review (each form's `kit × quantity = total`, and the expected amount is their sum), the scanner result (so the right number of kits is handed over), and a **Kits ordered** table on the Dashboard. Emails can use the merge fields `{{Kit}}`, `{{Quantity}}`, `{{Unit Price}}` and `{{Total Amount}}` (add them to a template with the field chips in Admin > Email).

## How a registration works
1. The attendee completes four steps: **event info and terms**, **participant's information**, **payment** (GCash number with a Copy button, QR image, sender name, amount, reference number, receipt file) and **review**. Unsent progress is kept in the browser tab only (never the receipt file).
2. Submitting creates a `pending_verification` registration and a `pending` payment. It holds a slot (pending forms count toward capacity) but has **no ticket number yet**. Free events (fee 0) skip the payment step and are confirmed immediately.
3. An admin opens **Admin > Payments**, views the receipt (a 5-minute signed link to the private bucket) and chooses:
   - **Verify**: the linked forms become `confirmed`, get ticket numbers, and the confirmation email is sent. If the amount is below fee x forms the admin must tick *Verify anyway* and give a reason.
   - **Mark underpaid**: the forms stay pending and keep their slots; the person is emailed the amount due and can resubmit from *My registrations*.
   - **Reject**: the forms are rejected and their slots released; the person is emailed the reason and can resubmit while slots remain.
4. **Shared payments:** one GCash payment can cover several forms until its **balance** (amount paid minus the totals of the forms already attached) is used up. A user may submit several forms and attach later ones to an earlier payment while enough is left.
5. Only `confirmed` tickets can be checked in by the scanner.

## Event images
Each event has five slots (Admin > Events > edit > **Media**): `poster`, `details_card`, `gcash_qr`, `banner`, `email_banner`. Until an image is uploaded a placeholder with the right aspect ratio is shown. Upload, replace, remove and edit alt text there; no redeploy is needed. No real artwork is included in the code or seed data. The email uses `email_banner`, then `banner`.

## Privacy: deleting receipts
Receipts and contact details are personal data (Philippine Data Privacy Act of 2012): only admins can read them. Set **Delete payment receipts N days after the event** on each event, then run, from your own machine or a scheduled job:
```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-receipts.mjs          # dry run: counts only
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-receipts.mjs --apply   # delete
```
It needs the service-role key (Project Settings > API). Keep that key out of the browser, the repo, and chat.

## Before the real event
- The Teenfresh logo is `src/logo/Logo 1.1.png`. The cropped copies used by the app (`src/logo/teenfresh-logo.png`), the email signature (`public/email/logo.png`) and the favicon (`public/favicon.png`) were generated from it; regenerate them if the logo changes. Replace `facebook.png`, `x.png` (email icons) with real artwork (same file names).
- **Admin > Events > ODD PLATINUM**: the seeded dates are the ones from the reference form (4 Oct 2026, deadline 30 Sep 2026) and are **in the past**, so the form shows "Registration closed". Set real dates (or run the commented `update` at the bottom of `002_registration_payments.sql` to test), the real **GCash number** (seeded as `09XXXXXXXXX`) and the masked account name, the capacity, and upload the images (**Media** tab).
- **Admin > Email**: review the four templates, send a test of each to yourself.

## Assumptions I made
- `events.event_date` stays the start time (the brief's `starts_at`); the migration adds `ends_at`, not a second start column.
- ODD PLATINUM: capacity 100 (the brief gives none), ticket prefix `IVEMONOP`, masked account name `BR**N CA**O S.` (the example in the brief), GCash number a placeholder.
- The older "BRILLIANT FORCE" event keeps working; it has fee 0 so it behaves as a free event with immediate tickets. Delete it in Admin > Events if you do not need it.
- A form orders one kit type with a quantity from 1 up to that kit's limit (default 5, set 1 to 50 per kit). The seeded ODD PLATINUM event has one kit, "Event kit" at 100 PHP, using the kit contents from the reference form; edit or add kits in Admin. Capacity still counts forms (entries), not kits.
- A user may submit several forms; the unique rule is **one active entry per X username per event** (case-insensitive). Rejected and cancelled forms free the username.
- A new form attached to an already verified payment is confirmed immediately (the payment was already checked).
- Resubmitting an underpaid payment replaces the amount, reference and receipt (earlier ones are kept in `receipt_history` for the admin); the person enters the **total** paid across both transfers.
- Receipts are checked by type, size and path in the browser, in the database function and in the bucket (JPG, PNG, WebP, PDF; 5 MB; stored as `<user id>/<random uuid>.<ext>`). Uploads are limited to 20 per user per hour and forms to 10 per hour.
- The GCash account number is stored on the event, so anyone who can open the form can see it (like on the reference Google Form).
- Emails are sent by the admin's browser calling the Edge Function right after the decision is saved (not a background queue). If that call fails the decision stays saved; use **Resend** (Payments dialog, Attendees, Email logs).
- The Terms editor is an HTML editor with formatting buttons and a live sanitized preview, not a WYSIWYG editor. Only simple formatting and https/mailto links survive, on the page (DOMPurify) and in the email (an equivalent whitelist in `merge.ts`).
- Attendees cannot write to `registrations` or `payments` directly (no insert/update policy); the RPCs are the only way, so capacity, deadline, duplicates, coverage and amounts cannot be bypassed from the browser.
- Live availability streams the public `event_counts` table (no attendee data); the `registrations` table itself is private.
- A transferred slot keeps its ticket number; the new owner gets the ticket by email. Edits are logged in `registration_changes`.
- QR payload is the plain ticket number; the server validates it, so a forged QR proves nothing.
- Attendee email resends: 1 per minute, 5 per hour per registration. Resend allows ~2 requests per second, so multi-sends pause 0.6 s between emails.

## Manual test checklist
1. **Dates:** make the ODD PLATINUM dates future (see above). Home shows its card with fee, deadline and "N of 100 slots left".
2. **Register:** sign up, then Register. Step 1: the Terms render with bold text and contact links; you cannot continue without ticking the agreement. Step 2: `@name` loses the `@`; `fb.com/TeenfreshPH` and `09171234567` are accepted and shown normalised on the review step. Step 3: Copy number announces "copied"; attach a receipt (try a `.exe` or a 6 MB file: it is refused). Review, Submit. The status page says **Pending verification** and shows no ticket.
3. **Capacity:** the Home count dropped by one straight away (pending forms hold a slot).
4. **Shared payment:** pay 200 PHP, submit two forms choosing "Use the payment details from one of my earlier forms" on the second; a third form on it is refused.
5. **Verify:** as admin, **Payments** > Review > view the receipt > Verify. The forms become *Confirmed* with ticket numbers and the confirmation email arrives (exact layout, correct merged values, the Terms from the event).
6. **Underpaid / rejected:** mark one underpaid (amount due) and reject another with a reason. The right emails arrive; *My registrations* shows the notice and **Send the missing amount** / **Upload a new receipt**; rejecting released the slot.
7. **Images:** every slot shows a placeholder with no layout shift. In Events > Media upload a poster; reload the form: it appears with its alt text and opens in a lightbox with a Download link. Replace it, then Remove it.
8. **Deadline:** set the deadline to the past (or close registration): the form is replaced by "Registration closed" and the card's button is disabled.
9. **Scan:** a *confirmed* ticket checks in (green); a duplicate shows amber; a pending form's name shows no ticket and cannot be checked in.
10. **Attendees / Dashboard:** the new columns (Facebook, contact, payment status), filters and CSV; the dashboard shows pending, confirmed, rejected and the verified total.
11. **Security:** a non-admin opening `/admin` is redirected; another user cannot see your payments or receipts.
12. **Privacy:** set "Delete receipts 0 days after the event" on a past event, run `purge-receipts.mjs` (dry run, then `--apply`): the receipt files are gone and the Payments dialog says the file was deleted.
