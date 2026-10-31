# Accessibility

**Target:** WCAG 2.2 Level AA (AAA for body text where it was cheap: `ink` on every surface is 9.2 to 13.7:1).
**Status:** automated checks pass (below). Manual assistive-technology testing has **not** been done yet. Use the checklist in this file before you call the app "conformant".

## How to run the checks

| Command | What it does |
|---|---|
| `npm run check:contrast` | Verifies every colour pairing in `src/styles/tokens.css`, asserts the forbidden pairings still fail, and scans `src/` for forbidden combinations, brand colours used as text, and stray hex values. **Runs automatically before `npm run build`, so a bad colour fails the build.** |
| `npm test` | Contrast tests, schema/RLS tests, email tests, and **vitest-axe on every shared component and every page** (zero violations). |
| `npm run lint` | ESLint with `eslint-plugin-jsx-a11y` (strict). |
| `npm run test:e2e` | Playwright + `@axe-core/playwright` in real Chromium: all 15 routes plus dialogs, scan results, the registration error/review/success states (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`), and behaviour checks (skip link, focus ring, route focus, 320px reflow, target size, reduced motion, forced colours, prefers-contrast, 200% zoom, 16px text). Desktop and a 320px phone viewport. The Supabase API is mocked, so no backend is needed. |
| `npm run lighthouse` | Lighthouse CI, accessibility score must be 95 or higher on /, /login, /register, /forgot-password (needs `CHROME_PATH`; Playwright's Chromium works). Reports are **not** uploaded anywhere. |

Last run: all of the above pass; Lighthouse accessibility = **100** on the four public pages. The Playwright scans cover all 17 routes plus every step of the registration form (with errors), the closed-event state, the payment review and confirmation dialogs, the Media tab and the payment resubmission dialog.

## Colour tokens

Brand colours (Teenfresh guidelines) are **surfaces only**: backgrounds, fills and bands. Text, borders, icons and focus rings use the accessible companion tokens. All of them live in `src/styles/tokens.css`; nothing else in `src/` may contain a hex value.

| Token | Hex | Role |
|---|---|---|
| `brand-cream` | `#f9e7b9` | Navbar, sidebar, header bands, "few slots" surface |
| `brand-blue` | `#65a6d0` | Primary button fill (ink label + ink border) |
| `brand-coral` | `#ec9697` | Accent fill, chart outline pairing |
| `brand-ivory` | `#fcf7e3` | Secondary button fill, table headers, hint panels |
| `brand-sky` | `#c4d6ea` | Progress track, hover, info surface |
| `brand-blush` | `#f1d0d9` | **Page background**, error / sold out / invalid surface |
| `brand-mint` | `#dfecde` | Success / available / valid surface |
| `ink` | `#17303f` | Text, icons, focus ring |
| `ink-muted` | `#2b4c63` | Secondary text (never on blue or coral) |
| `link` | `#1c5a85` | Links, input and card borders, progress fill, email links |
| `danger` | `#8a1f2b` | Errors, destructive, sold out / invalid text |
| `success` | `#0b5d3b` | Success, available / valid text |
| `warning-ink` | `#3d2c00` | Few slots left / already checked in text |

### Verified contrast (WCAG relative-luminance formula, from `npm run check:contrast`)

| Foreground | Background | Ratio | Needs | Use |
|---|---|---|---|---|
| `ink` | `white` | 13.72 | 4.5:1 | body text |
| `ink` | `brand-ivory` | 12.77 | 4.5:1 | body text |
| `ink` | `brand-cream` | 11.21 | 4.5:1 | body text |
| `ink` | `brand-mint` | 11.23 | 4.5:1 | body text |
| `ink` | `brand-blush` | 9.64 | 4.5:1 | body text |
| `ink` | `brand-sky` | 9.24 | 4.5:1 | body text |
| `ink` | `brand-coral` | 6.12 | 4.5:1 | body text |
| `ink` | `brand-blue` | 5.17 | 4.5:1 | body text |
| `ink-muted` | `white` | 9.06 | 4.5:1 | secondary / helper text |
| `ink-muted` | `brand-ivory` | 8.44 | 4.5:1 | secondary / helper text |
| `ink-muted` | `brand-cream` | 7.41 | 4.5:1 | secondary / helper text |
| `ink-muted` | `brand-sky` | 6.11 | 4.5:1 | secondary / helper text |
| `ink-muted` | `brand-mint` | 7.42 | 4.5:1 | secondary / helper text |
| `ink-muted` | `brand-blush` | 6.37 | 4.5:1 | secondary / helper text |
| `link` | `white` | 7.37 | 4.5:1 | links |
| `link` | `brand-ivory` | 6.86 | 4.5:1 | links |
| `link` | `brand-cream` | 6.02 | 4.5:1 | links |
| `link` | `brand-sky` | 4.97 | 4.5:1 | links |
| `link` | `brand-blush` | 5.18 | 4.5:1 | links |
| `link` | `brand-mint` | 6.03 | 4.5:1 | links |
| `danger` | `white` | 9.08 | 4.5:1 | error text |
| `danger` | `brand-ivory` | 8.46 | 4.5:1 |  |
| `danger` | `brand-blush` | 6.39 | 4.5:1 | sold out / invalid / alert |
| `danger` | `brand-cream` | 7.42 | 4.5:1 |  |
| `success` | `white` | 7.95 | 4.5:1 | success text |
| `success` | `brand-mint` | 6.50 | 4.5:1 | available / valid |
| `success` | `brand-ivory` | 7.40 | 4.5:1 |  |
| `warning-ink` | `brand-cream` | 11.01 | 4.5:1 | few slots / already checked in |
| `warning-ink` | `white` | 13.47 | 4.5:1 |  |
| `warning-ink` | `brand-ivory` | 12.54 | 4.5:1 |  |
| `white` | `danger` | 9.08 | 4.5:1 | destructive button |
| `brand-ivory` | `ink` | 12.77 | 4.5:1 | hover / current nav |
| `white` | `link` | 7.37 | 4.5:1 | text on link fill |
| `link` | `white` | 7.37 | 3:1 | input / card border |
| `link` | `brand-ivory` | 6.86 | 3:1 | border |
| `link` | `brand-sky` | 4.97 | 3:1 | progress fill on track |
| `ink` | `white` | 13.72 | 3:1 | focus ring |
| `ink` | `brand-ivory` | 12.77 | 3:1 | focus ring |
| `ink` | `brand-cream` | 11.21 | 3:1 | focus ring |
| `ink` | `brand-sky` | 9.24 | 3:1 | focus ring |
| `ink` | `brand-blue` | 5.17 | 3:1 | button outline / chart outline |
| `ink` | `brand-coral` | 6.12 | 3:1 | chart outline |
| `brand-ivory` | `ink` | 12.77 | 3:1 | focus ring on ink surfaces |
| `danger` | `white` | 9.08 | 3:1 | invalid input border |
| `success` | `brand-mint` | 6.50 | 3:1 | alert bar |
| `warning-ink` | `brand-cream` | 11.01 | 3:1 | alert bar |
| `danger` | `brand-blush` | 6.39 | 3:1 | alert bar |
| `brand-blue` | `white` | 2.65 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `brand-coral` | `white` | 2.24 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `brand-blue` | `brand-cream` | 2.17 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `brand-cream` | `white` | 1.22 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `brand-sky` | `white` | 1.48 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `link` | `brand-blue` | 2.78 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `link` | `brand-coral` | 3.29 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `danger` | `brand-blue` | 3.43 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `danger` | `brand-coral` | 4.06 | fails (<4.5), forbidden as text | FORBIDDEN as text |
| `ink-muted` | `brand-blue` | 3.42 | fails (<4.5), forbidden as text | FORBIDDEN as text |

The ratios match the ones in the brand add-on (checked by `tests/contrast.test.js`).

## How state is communicated (never colour alone)

- **Badges** show an icon, the words and the colour (`Available`, `Few slots left`, `Sold out`). The icon is CSS content with an empty alt, so it is not read twice.
- **Availability:** the bar is `link` on a `sky` track, and the card always prints "X of Y slots left".
- **Scan results:** a full-width panel with a large icon and the words "Valid ticket" / "Already checked in" / "Invalid ticket", announced through one `aria-live="assertive"` region (name, X username, ticket number, status). Sound and vibration are optional (toggle) and never the only cue.
- **Errors:** an error summary takes focus after a failed submit; every message is text with an icon, linked with `aria-describedby`, and the field gets `aria-invalid`.
- **Links** are always underlined.
- **Charts** use outlined bars with printed values, plus a data table ("View data table") for screen readers.

## What was built for WCAG 2.2 (and where to look)

| Area | Implementation |
|---|---|
| Landmarks, one `h1` per page, skip link | `AttendeeLayout`, `AdminLayout`, `AuthShell`, `SkipLink` in `src/a11y.jsx` |
| Unique `<title>`, focus to `h1` on route change, announcement | `RouteA11y` in `src/a11y.jsx` |
| Live regions (status vs alert) | `LiveRegionProvider`, `Toast`, `Alert`, scanner region |
| Forms: labels, "(required)", `aria-required`, hints, errors, summary, autocomplete | `Field`, `ErrorSummary`, `PasswordInput` |
| Accessible authentication (3.3.8) | No CAPTCHA, paste allowed, show/hide password, Google sign-in |
| Redundant entry (3.3.7), error prevention (3.3.4) | Name and email pre-filled; review step before a ticket is created |
| Dialogs | `Modal`: labelled, focus trapped, Esc closes, focus returns |
| Tables | `DataTable`: caption, `scope`, `aria-sort`, labelled scroll region, pagination `nav`, result count in a live region, unique row-action names |
| Focus (2.4.7, 2.4.11) | 3px `ink` outline, 2px offset, `scroll-padding-top` for sticky headers |
| Target size (2.5.8) | 44 x 44 px minimum on buttons, links in nav, inputs |
| Motion, contrast, forced colours | `prefers-reduced-motion`, `prefers-contrast: more`, `forced-colors` rules in `src/index.css` |
| Session ending (2.2.1) | Supabase refreshes tokens automatically (there is no timeout). If a session ends unexpectedly the sign-in page says so. |
| Realtime updates | Throttled to one screen-reader announcement per 10 seconds |
| Terms | Real `button` with `aria-expanded` (account pages); on the form the full text is shown, rendered through a whitelist sanitizer; the agreement is a native checkbox in a labelled `fieldset` |
| Multi-step form | `Stepper` is a labelled `<ol>` with `aria-current="step"`; focus moves to the step heading on every step change; per-step zod validation with an error summary; a review step with Edit buttons before anything is created |
| Receipt upload | `FileUpload`: the native file input stays focusable (the label is its button), drag and drop is optional, the chosen file name, size and any error are announced, and the file can be removed or replaced |
| Copy number | `CopyButton` announces "copied" in a live region and changes its label |
| Event images | `EventImage` reserves the aspect ratio, falls back to a placeholder, has editable alt text, and opens in a focus-trapped lightbox (Esc closes) with a Download link. The same facts are always printed as text next to the poster and details card |
| Payments | Receipt viewer with a short-lived signed link; every action goes through a confirmation dialog; stacked dialogs only react to Esc and Tab on the top one |

## Deviations from the add-on (WCAG wins, as it asked)

1. **Shared components:** `Badge`, `Alert`, `Field`, `ErrorSummary`, `PasswordInput`, `Toast`, `Modal`, `DataTable`, `LiveRegion` are React components. **Button, Input, Select, Checkbox and Card are Tailwind component classes** (`.btn-primary`, `.input`, `.check`, `.card` in `src/index.css`), not wrapper components. Accessibility is still built in once, but there is no `<Button>` element to import.
2. **Text size:** body and most UI text are 16px. The smallest text (chart labels, captions, table headers) is **14px**, not 16px. Say so if you need a hard 16px floor.
3. **Google "G" logo** uses Google's own multicolour hex values (a third-party trademark); it is the single allow-listed exception to "no hex outside tokens.css".
4. **Email** keeps the Gmail-like format from the main brief (Arial, dark text on white, inline CSS). Links use the `link` colour (`#1c5a85`, 7.4:1 on white). The body text (`#222222`) and the quote border (`#dadce0`) are the brief's Gmail-like values, not brand tokens, because email needs inline hex.
5. **Event images** are placeholders until an admin uploads them (Admin > Events > Media). `public/banners/ivemon.png` is a placeholder I generated for the older demo event. The Teenfresh logo is the real artwork from `src/logo/`: it is decorative inside links (the link carries the name, e.g. "Teenfresh Events, home") and has alt text "Teenfresh" elsewhere. Text baked into your final banner needs its own contrast check.
6. **Tooltips:** the hover `title` tooltip on the attendee email badge was removed (it cannot be dismissed, 1.4.13); the error text is in the detail dialog.
7. **Dark mode** is not provided.

## Known limitations

- The camera view is rendered by the third-party `html5-qrcode` library. The app labels the container and offers manual check-in as an equal alternative, but the library's own markup was not audited while the camera is running.
- Playwright and axe use a **mocked** Supabase API. They prove the markup is accessible, not that the live backend behaves.
- Automated tools find roughly a third of WCAG issues. Screen reader behaviour, reading order in context, and plain-language quality need people.
- axe cannot evaluate colour contrast in forced-colors mode; that mode is tested for structure and border behaviour only.

## Manual checklist (do this before launch)

1. **Keyboard only** (unplug the mouse): sign up, sign in, register for an event (including the error summary and the review step), open My ticket; as admin, create an event, scan or manually check in a ticket, open and close the attendee dialog, send a test email. Check: focus is always visible, never trapped (except in dialogs), order is logical, the skip link works.
2. **Screen readers:** NVDA + Firefox and Chrome (Windows), VoiceOver + Safari (macOS and iOS), TalkBack + Chrome (Android). Check: page titles announced on navigation, form errors announced, the scan result is read out after a scan, badges read as words, tables read with headers, slot-count updates are not noisy.
3. **Zoom and reflow:** 200% and 400% zoom, 320px wide, no horizontal page scroll (only inside labelled table regions), text resizing to 200% in browser settings.
4. **Windows High Contrast / forced colours:** buttons, badges, the progress bar and focus ring are all visible.
5. **Reduced motion:** the OS setting removes spinners' motion and transitions.
6. **Phone scanner test:** scan a real QR with VoiceOver on and TalkBack on; confirm the result is announced and the panel is readable outdoors.
7. **Text spacing:** apply the 1.4.12 bookmarklet (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); nothing is clipped or overlaps.
8. **Email:** open the confirmation in Gmail, Outlook and Apple Mail with images off: alt text is meaningful and links are readable.

## Reporting an accessibility issue

The footer of every page has a **Report an accessibility issue** link. It emails the address in `VITE_SUPPORT_EMAIL` (set it in `.env`), and falls back to the Teenfresh X page (@TeenfreshPH) if unset. Include the page, what you tried to do, the browser and any assistive technology.
