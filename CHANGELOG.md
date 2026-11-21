# Changelog

All notable changes to the Teenfresh event registration and attendance system.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is [SemVer](https://semver.org/):
`1.0.0` is the first release and covers everything from the initial commit up to commit `5024be1`. `1.1.0` adds Excel reports and fixes typing in dialogs. `1.2.0` makes underpayments top-ups. `1.2.1` tidies the public footer. `1.3.0` makes one form equal one kit. `1.4.0` lets people type the reference number freely. `1.4.1` shows My registrations as event-style cards and recolours the mobile admin bar. `2.0.0` moves to Vue 3 + Nuxt 3 and Cloudflare Pages. `2.1.0` is the pastel ticket-stub redesign, slugs, server rendering and SEO, and TypeScript + Pinia. `2.2.0` finishes the design: slim nav and account menu, home hero, new ticket card, Shop the drop. `2.3.0` adds editable web addresses and a home page headline, and loads the home photo sooner. `2.4.0` adds an editable home banner, stock on every product, the lowest in-stock price and the pre-order period. `2.5.0` makes the banner headline and description editable. `2.6.0` shrinks admin pictures when they are uploaded. `2.6.1` makes that work in Safari. `2.7.0` prices products by their variations and locks the quantity until one is picked. `2.8.0` refuses oversized uploads and stops visitors saving pictures. `2.9.0` compresses every uploaded picture with the Squoosh encoder. `2.10.0` shows a product's categories on its shop card. `2.11.0` adds stock to the card, pre-orders included. `2.11.1` shows stock on the product page too, beside the price, and on every card.

## [2.13.4] - 2026-11-22

No migration.

### Fixed
- **The admin Payments page no longer scrolls sideways on a phone**: the event picker beside the title could be wider than a 320 to 390 px screen when the event's name was long. It now shrinks to the screen's width.

### Changed
- **The automatic browser tests match the current design**: the home hero, the event cards (poster across the top, sticker facts), the ticket grid (three to a row), the Payments table, and the carts saved per account. No change to the site itself.

## [2.13.3] - 2026-11-22

No migration.

### Fixed
- **The event poster has its right size from the first moment**: on a laptop it used to be squeezed to the height of the details beside it until the picture finished loading, then jump bigger (so the first visit to an event looked wrong and a second visit, with the picture already saved, looked right). Its size now follows the column's width and the poster's 3:4 shape, so it does not change when the file arrives. This applies to every event, including new ones. The poster also loads first, not lazily, and the home hero reserves the same 3:4 space.

## [2.13.2] - 2026-11-22

No migration.

### Fixed
- **My registrations lines up with the navbar**: the heading and the tickets start at the navbar's left edge on every screen width. On very wide screens the tickets used to spill 8 rem past the navbar on each side to fit four in a row; they now stay inside the page width, three to a row.

## [2.13.1] - 2026-11-22

No migration.

### Fixed
- **My registrations: the heading and the tickets share one left edge** on very wide screens (1536 px and up). The ticket grid grows 8 rem each side for four tickets in a row, but the heading did not, so a single ticket sat about 128 px to the left of the title.

## [2.13.0] - 2026-11-22

No migration.

### Added
- **A countdown to the event's start** on the event page and in the home hero: four sticker tiles (days, hours, minutes, seconds). When the event has started it says "Happening now" until its end time, then disappears. Screen readers hear one sentence that updates each minute.

## [2.12.0] - 2026-11-20

No migration.

### Changed
- **The Keepsake look reaches the event page, the register page and the shop**: the poster is a tilted photocard on a pastel backdrop, the facts sit in a soft panel, the register steps are a ticket strip with a "your ticket" summary and running total, and the shop header and category chips follow the same style.
- **The slots badge is a sticker on the poster's top-right corner**, with the number and "of N slots left" stacked tight in the middle of the circle. It is now the only place the slot count is shown on the event page (the header sticker and the "Slots" progress section are gone); the Register panel is just the button, or the reason it is unavailable.
- **Event cards show the poster edge to edge** across the top of the card, like the shop's product cards, instead of a small tilted card on a coloured background. The frame is 4:5 for every poster, so a row of cards lines up; only a sliver of a poster's edges can be trimmed.
- **On a laptop (1024 px and up) the event poster fills its column** down to the Register button, whole and uncropped, and the page is wider with an even poster/facts split.
- **The home page says the QR ticket is in your account** (step 3 of "How it works" and the intro line), with the email as a follow-up for updates, not the only way to get it.
- **On a phone or tablet the home page shows the poster first**, then the event's title, facts and buttons (on a laptop the details stay on the left and the poster on the right).
- **The home page gets a "How it works" section**, and past events are tilted photocard rows.
- **The sign-in and sign-up pages show the next event's poster** beside the form on wide screens (plain centred card on phones or with no upcoming poster).
- **The admin Payments page follows the new design**: a big title with "Check receipts and verify tickets.", the event picker beside it, summary chips (slots taken, waiting for review, payments short, checked in), a white list card with a To review / All / Verified switch and a search box, and a "Review payment" panel beside it with the receipt, Expected and Paid, and the buttons "Verify and send ticket", "Mark as short" and "Reject". The first payment is open by default on a tablet or laptop. The Forms and Submitted columns moved into the panel's "More details"; Export Excel is still there, and Underpaid and Rejected payments are under All.
- **The admin menu has 7 items instead of 11**: related pages share one item, and the pages inside it are a pill switch under the page title (the same look as the Payments status switch): Events (Events, Home page), Shop (Products, Orders), Attendees (Attendees, Attendance, QR Scanner) and Settings (Admin users, Change log). Dashboard, Payments and Email stay as they are. **Shop orders left the Payments page** and are now Shop > Orders (`/admin/orders`); Payments shows event payments only. Old `/admin/payments?tab=shop` links and the shop notifications go to the new place.
- **The admin sidebar is dark** with light links and a pale pill on the current page; the scanner has its own accent button at the bottom.
- **`npm run deploy:staging`** builds against the dev Supabase project (`.env.development`) and deploys to the `staging` branch; `npm run deploy` still deploys to production.

### Fixed
- **The home page has two clear lists: "Upcoming events" and "Past events"** (the first was called "More events"). An event is upcoming until it is over, and past after that.
- **An event whose registration is closed stays in the upcoming list** on the home page until the event is over (its end time, else its start), and its ticket says "Registration closed". It used to drop into "Past events" as soon as registration closed or sold out, even though people still visit to see it.
- **Each account has its own saved cart**: it was kept under one fixed key, so every account signed in on the same browser (and signed-out visitors) shared one cart.

## [2.11.1] - 2026-11-17

No migration.

### Changed
- **The category tags on a product page are links**: one opens the shop already filtered to that category (`/shop?category=…`). Only the main product page links; cards, the related products and the admin list stay plain.
- **The home page is back to its earlier look** (rounded cards, the yellow hero, the ticket with the poster on top); the new design experiments were taken out. The events section keeps the name "More events".
- **The event page shows the poster and the details picture at the full width of the page** (they were held to a narrow 28 rem column), with their own proportions and no cropping; they stretch with the window.
- **The product page shows the product's categories** as tags beside the artist name, like the cards, and the related-product cards show theirs. The card tags are a little smaller.
- **Categories on a card sit beside the artist name** as filled, rounded-rectangle tags (they were small text above it).
- **The admin product list shows each product's stock** next to its price ("10 in stock", "Only 3 left", "Sold out", or "In stock" when no count is kept; with variations, every variation's stock added up).
- **The product form shows "Available stock"** when a product has variations: their stocks added up, live as you type.
- **On the home page, "Shop the drop" is now "Shop"** and its button "See more" (it said "See the whole shop"). Its cards show categories and stock like the shop's.
- **The shop heading no longer has the line under it** ("Official merch, paid by GCash. Pick a product…").

### Fixed
- **Every card shows its stock** ("In stock" when no count is kept), on the same row as the price, at its right edge; the "related" cards too.
- **The product page now always shows the stock**, when a count is kept ("12 in stock", "Only 3 left"), pre-orders included. Before it appeared only at 5 or fewer. With versions it shows the chosen version's count, else the total.

## [2.11.0] - 2026-11-17

No migration.

### Added
- **Stock on every shop card, pre-order products included**: "12 in stock", "Only 3 left" (5 or fewer) or "Sold out", added up over the versions still on offer. Nothing is shown when no stock count is kept.
- **A pre-order product shows "Pre-Order" in its category line**, so a product that is only a pre-order (no categories of its own) still has one.

## [2.10.0] - 2026-11-17

No migration.

### Added
- **Shop product cards show their categories** in small capitals above the product name (several are separated by "·"). A product with no categories shows nothing extra.

## [2.9.0] - 2026-11-15

No migration. New dependency: `@jsquash/webp` (Squoosh's WebP encoder as WebAssembly).

### Changed
- **Every uploaded picture is compressed with Squoosh's encoder** (jSquash), in the browser, before it is sent: the home banner (1920 px wide), product photos (1600 px), event pictures (their slot's size), and now **payment receipts** too (2000 px, so they stay readable). The result is a WebP in every browser, Safari included, and is kept only when it is smaller than the original. A PDF receipt goes up unchanged. The encoder loads only when someone uploads, so visitors download nothing extra. If WebAssembly cannot run, the browser's own compressor is used, and failing that the original is uploaded.
- **GCash QR codes are compressed losslessly** (every pixel is kept), instead of being left as they were.
- Small pictures are compressed too (before, anything under 200 KB was left alone).
- The security policy now allows WebAssembly for scripts (`'wasm-unsafe-eval'`). This does not allow `eval()` or inline scripts.

### Fixed
- A receipt photo between 5 and 10 MB passed the app's own check but was refused by the receipts storage (5 MB limit). Receipts are compressed first, so they go through.

## [2.8.0] - 2026-11-15

No migration.

### Added
- **Oversized uploads are refused.** After the admin upload shrinks a picture, anything still over 1.5 MB is not saved: a message says how big it is and asks for a smaller picture. Nothing is uploaded. GCash QR codes are not shrunk or limited.
- **Visitors cannot save the pictures.** On the public pages, right-click and long-press menus, and dragging a picture out of the page, are switched off. The GCash QR codes and a person's own receipt preview can still be saved, and the admin area, text, links, keyboards and screen readers are untouched. This only discourages casual saving; the browser's own tools can still reach the files.

## [2.7.0] - 2026-11-15

No migration.

### Changed
- **Quantity is locked until a version is picked.** On a product with variations the quantity buttons are off (and the total shows a dash) until the shopper chooses a version; each new pick starts again at 1. A product with no variations is unchanged.
- **A product with variations has no price of its own.** In admin the product Price field is hidden once a variation exists, every variation (or layer combination) needs its own price, and the product saves the lowest of them as its base price. "Same as product" is gone. A product with no variations still has its Price field. Older variations that had no price open pre-filled with the product's price, so nothing has to be retyped.
- **Price range.** The shop card, home "Shop the drop", the product page (before a version is picked) and the related products show the range from the lowest to the highest price among the versions still in stock, for example ₱750.00 – ₱900.00 (one price when they cost the same; the range of all versions when everything is sold out). It replaces "From".

## [2.6.1] - 2026-11-15

No migration.

### Fixed
- **Shrinking pictures in Safari.** Safari cannot save a WebP from the page and quietly hands back a PNG, so the picture was uploaded at its original size. A JPEG photo is now saved as a smaller JPEG there (a PNG stays a PNG), so it shrinks in every browser.

## [2.6.0] - 2026-11-15

No migration.

### Changed
- **Admin pictures are shrunk before they upload.** The home banner (up to 1920 px wide), product photos (1600 px) and event pictures (the size of their slot) are resized in the browser and saved as WebP, so a 6 MB camera photo becomes a few hundred KB. A small picture that already fits is left alone, and if shrinking does not make the file smaller the original is uploaded. The GCash QR codes are never touched, so they stay sharp. Pictures already uploaded are not changed: replace a large one to shrink it.

## [2.5.0] - 2026-11-15

Needs one new migration, `037_home_hero_text.sql` (two optional columns). Until it runs, the banner keeps its usual text, and saving the Home page screen in admin fails.

### Added
- **Editable banner text.** The admin **Home page** screen has a **Headline (the event name)** (up to 120 characters) and a **Description under the headline** (up to 300). Empty fields keep the old behaviour: the featured event's headline, subtitle or title, and the standard sentence.

## [2.4.0] - 2026-11-15

Needs three new migrations, run in this order in the Supabase SQL Editor: `034_home_settings.sql`, `035_product_stock.sql`, `036_preorder_period.sql`. The site keeps working before they run (no banner, no stock or pre-order dates), but saving a product in admin needs 035 and 036.

### Added
- **Editable home banner.** Admin has a new **Home page** screen: add, change or remove a banner background picture (JPG, PNG or WebP, up to 10 MB, with a preview), describe it for screen readers or mark it decorative, and choose which event is featured in the banner (or leave it on automatic). Without a picture the plain cream background stays. A cream overlay sits between the picture and the content, and its contrast against a black and a white picture is part of `npm run check:contrast`.
- **Stock on the item.** A product with no variations has its own stock (empty = not counted, 0 = sold out); a product with variations counts stock on each variation. `place_order()` checks and takes the stock per variation, or from the product, in one step, and cancelling or deleting a live order puts it back. A product is Sold out only when all its variations are at 0.
- **Pre-order period.** A pre-order can have a start date and a last day to order, read in Philippine time. While it is open the Pre-order badge shows; after it ends the thumbnail says "Pre-order period ended" and Add to cart / Buy now are switched off (`place_order()` refuses it too, with `PREORDER_ENDED`; before the start, `PREORDER_NOT_STARTED`).

### Changed
- **Home banner is fluid.** Padding, headline size and minimum height follow the screen width from 360px to 1920px with no sideways scroll; the text and the ticket sit side by side from 1024px and stack below.
- **Price shown.** The shop card, product page and product data show the lowest price among the variations still in stock ("From ₱x"); when everything is sold out, the lowest price with the Sold out badge.
- **Footer** no longer repeats the logo; the social icons and handle sit left and the accessibility link right.
- **Featured ticket photo** is shown whole instead of cropped to 16:9, so a poster's top text is not cut off.

### Fixed
- **Category chips.** Every category now has a chip again. A rule added on 2026-11-13 hid a chip unless its category had two or more products, so a small shop showed none.
- `npm run lint` pointed at `nuxt.config.js` (now `.ts`) and never ran; it works again.

## [2.3.0] - 2026-11-15

### Added
- **Web address field** in the admin event and product forms. Type a new one (letters, numbers and dashes are kept, the rest is cleaned, and a clash gets `-2`); leave it empty to keep the current address. Old addresses keep working.
- **Home page headline** on events (migration `033_event_tagline.sql`, up to 120 characters). The home hero shows it, then falls back to the subtitle, then the title.

### Fixed
- The featured event's photo on the home page was lazy-loaded, which delayed the largest paint (Lighthouse flagged it). It now loads right away with high priority.

## [2.2.0] - 2026-11-15

The rest of the soft pastel design: slim navigation with an account menu, the home hero, the new event ticket card and Shop the drop.

### Changed
- **Navigation.** One slim pill row on a desktop (logo left; Events, Shop, Cart and an **Account** menu right). My orders, My registrations, Notifications, Admin and Sign out moved into the Account menu (it opens by keyboard, closes with Escape and returns focus). On a phone there is a **bottom bar** (Events, Shop, Cart, Account or Sign in) with 44px targets; the Account menu opens upwards.
- **Home page.** A hero with the featured event's subtitle as the headline, two buttons (See events, Browse shop) and the featured event as a ticket card; the other events follow under "More events"; a **Shop the drop** section shows the four newest products. The featured event is the next one people can still register for.
- **Event ticket card.** The photo, then a pastel header (coral, mint or blue per event) with the title and status chip, a compact two-column grid (Date, Time, Fee or Kits, Slots left), the slots bar, a decorative barcode strip above the Register button.
- Tests: the picture comparison tests and the new navigation tests (menu, bottom bar, focus rings, 44px targets, axe) cover the new look; the old icon-row tests were replaced by facts-grid tests.

## [2.1.0] - 2026-11-15

The redesign, readable addresses, server rendering and the TypeScript conversion. **Run `supabase/migrations/032_slugs.sql`** (already applied on the live project).

### Changed
- **Redesign: soft pastel + ticket stub.** A rounded pill navbar, fully rounded buttons, white 24px cards with soft shadows, event cards styled as concert tickets (coloured header, notches, dashed perforation, optional barcode), product cards with one small status badge (Sold out, Low stock, New, Pre-order) and "From" prices, a ticket-stub cart, soft checkout panels, redesigned sign-in pages, and a calmer admin area (white sidebar and top bar, pastel stat cards, rounded tables). New shared components: `BaseButton`, `StatusChip`, `PillNav`, `TicketCard`, `ProductCard`, `CartStub`; review them at `/styleguide`. The accent pink is `#B83A58` with white text (5.55:1). Payment is still GCash only.
- **Readable addresses.** Events and products get a `slug` (migration `032_slugs.sql`): `/events/<slug>`, `/events/<slug>/register`, `/shop/<slug>`. Old id addresses still work and redirect permanently. There is now a public event page (`/events/<slug>`) with the facts, slots, poster, terms and a Register button.
- **Server rendering and SEO** for the public pages, with a unique title, description, Open Graph tags and canonical link per page, Event and Product JSON-LD, real 404s, `sitemap.xml` and `robots.txt`. **Hosting now runs a Cloudflare worker** (see the README): the Content-Security-Policy moved from `public/_headers` to `server/plugins/security.ts` (still no `unsafe-inline` for scripts), and `npm run deploy` publishes the `dist` folder.
- **TypeScript and Pinia.** The app is TypeScript (`npm run typecheck`), and the cart and sign-in state are Pinia stores (`stores/`); `useAuth()` and `useCart()` keep their API.
- Tests: the picture-comparison tests run against the production build (the dev server moved things by a pixel or two); new tests for the shop, cart, checkout, SEO tags and the server-rendered HTML; unit tests for slugs and badges.

### Fixed
- The admin Shop products page stayed on "Loading products" and the shop lost its sold-out and "From" price info (a missing import); adding more than one of a product threw an error (a missing import); several icons (sign-in page titles, dashboard stats, Export buttons) were never drawn. Found by the new browser tests and the type checker.

## [2.0.0] - 2026-11-15

The front end moves from React to Vue 3 + Nuxt 3, and hosting moves from Firebase Hosting to Cloudflare Pages (see Changed). Smaller changes made after 1.4.1 are listed below.

### Changed
- **The front end is now Vue 3 + Nuxt 3** (single-page mode, `ssr: false`) instead of React + Vite. Every page, form, dialog and admin tool was ported one for one; the look (Tailwind, the Teenfresh tokens, the Matahari fonts), the URLs, the Supabase database, Edge Functions and migrations are unchanged, and the Playwright + axe run passes against the new app. The plain-JavaScript logic moved from `src/lib/` to `lib/` untouched. Forms use plain refs and zod (react-hook-form is gone), the QR code is drawn by `qrcode-generator` (qrcode.react is gone), and the React context providers became composables (`useAuth`, `useCart`, `useToast`, `useAnnounce`).
- **Hosting moved from Firebase Hosting to Cloudflare Pages.** `firebase.json` and `.firebaserc` are replaced by `public/_headers` (the same security headers, with Nuxt's one inline settings script allowed by hash at build time) and `public/_redirects` (single-page fallback). `npm run deploy` now publishes with `wrangler pages deploy`. **After the first deploy, add the new address to Supabase > Authentication > URL Configuration.**
- The React component tests (jsdom + vitest-axe) were removed with React; the unit tests for the plain logic stay, and the browser run covers the screens.

### Added
- **Admin: Order emails (`/admin/order-emails`).** Edit the subject, heading and message of each shop order email (received, paid, shipped, cancelled), with a live plain-text preview built by the same code that sends the email. Placeholders `{{Name}}`, `{{Order Number}}` and `{{Total}}` are filled in per shopper; a mistyped one is caught before saving. A blank line starts a new paragraph, and typed text is always escaped, so it cannot add markup. The items, totals and delivery address are added under the text automatically. **Restore default wording** brings the original text back. **Run `supabase/migrations/013_order_email_templates.sql`, then redeploy the function: `supabase functions deploy send-order-email`.**
- **Shop order emails.** The shopper gets an email when the order is received (right after checkout, with the items, totals and delivery address), when payment is confirmed, when it ships, and when it is cancelled. Admins trigger the last three by changing the status; the toast says whether the email went out, and the order dialog lists every email with Sent or Failed. A failed email never undoes the order or the status change. New Edge Function `send-order-email` and `supabase/migrations/012_order_emails.sql`. **Run 012 and `supabase functions deploy send-order-email`** (same mail settings as the other emails). 
- **Shop checkout.** Shoppers add products to a **cart** (`/cart`, kept in the browser, with a count in the nav), sign in, and **check out** (`/checkout`): contact and delivery details, then payment by **GCash** with the sender name, reference number and a receipt upload, exactly like event registration. Prices are in US dollars and are converted to pesos at a rate an admin sets; the rate is saved on the order. The **order page** (`/orders/:id`) shows the thank-you, items, totals, delivery details and what happens next, and **My orders** (`/my-orders`) lists them with their status (awaiting payment check, paid, shipped, cancelled).
- **Admin: Shop orders (`/admin/orders`).** Checkout settings (pesos per dollar, shipping fee, GCash name and number; checkout stays closed until a GCash number is set), an order list with status filters, and a review dialog with the receipt, items and delivery details to mark an order paid, shipped or cancelled, with a private note.
- The database creates orders only through `place_order()`, which prices every line from the products table (the browser sends ids and quantities, never prices), checks the details and the receipt path, and refuses a reference number already used on a live order. Shoppers read only their own orders; only admins update them. **Run `supabase/migrations/011_orders.sql` after 010 before using checkout.** No emails are sent for orders yet, and order changes are not in the Change log.
- **Admin: Shop products (`/admin/products`).** Admins add, edit, hide and delete the products on the Shop page: artist, title, price in USD, discount %, Pre-order and NEW switches, the shop categories (BEST, ALBUM, Drama/Movie, DVD, PHOTOBOOK, MD, 2027 Season's Greetings), a visible switch, and an image upload (JPG, PNG or WebP up to 10 MB, with a description for screen readers) that is stored in the `event-media` bucket under `products/`. The form lists every problem in one summary. Replacing or deleting a product removes its old image file. **Run `supabase/migrations/010_products.sql` in the SQL Editor before using it.** Visitors can read only visible products; only admins can write (covered by tests in `tests/schema.test.js`). Product edits are not in the Change log yet.
- **Shop page (`/shop`)** with a "Shop" link in the main navigation. A white panel with the title, filter chips (All, BEST, ALBUM, Drama/Movie, DVD, PHOTOBOOK, MD, Pre-Order, 2027 Season's Greetings) and a product grid of 1, 2 and 4 columns (at 480 and 1024 px). Each card has the square image, a PRE-ORDER label, artist, title (two lines at most), discount, price and a NEW badge; a card lifts and its image zooms slightly on hover (not with reduced motion). Chips filter the grid and announce the count to screen readers. Products come from the database and show only when switched on. Colours come from the design tokens (the rose of the footer icons for PRE-ORDER, the error red for the discount), so the contrast check covers them.
- **Ticket-shaped cards on My registrations.** Each registration is a vertical ticket: the event banner, title and status, then Date, Venue, For and Kit with icons, a dashed perforation, and a stub. A round notch is cut out of both sides at the perforation, and the outline and shadow follow the notches. Tickets in a row have equal heights and the perforation lines up, even when one stub is taller (browsers without CSS subgrid still work but may not align it).
- The stub depends on the status: **confirmed** shows "Ticket no.", the ticket number, a Copy button, a decorative barcode strip and **View ticket**; **pending** shows "Awaiting payment check" and the 48 to 72 hours note; **underpaid or rejected** shows the message and the **Send the missing amount** / **Upload a new receipt** button; **cancelled** is muted. A **VOID** stamp appears on rejected tickets only (decorative; the badge and message carry the meaning).
- **Copy ticket number** icon button (accessible name "Copy ticket number", announces "copied").
- **The Teenfresh logo on loading screens**: the full-page loader and the page-level loaders (Events, My registrations, the registration form, the admin Dashboard, "Signing you in…") show the logo above the spinner. It pulses gently, and stays still when reduced motion is on. Small inline loaders keep the plain spinner.
- Tests: `e2e/tickets.spec.js` (real cut-out notch, perforation alignment, a stub per status, keyboard order, forced colours, axe and screenshots at 360, 768, 1280 and 1600 px), `tests/ticket.test.jsx`, `tests/loading.test.jsx`; contrast pairs for the ticket colours in `scripts/contrast.js`.

### Changed
- My registrations is a grid of 1, 2, 3 and 4 columns at 640, 1024 and 1536 px (tickets at most 420 px wide on phones). Without mask support the ticket is a plain rounded card; in forced-colours mode it is a plain bordered card.

### Fixed
- On My registrations, the "Payment rejected" message and the **Upload a new receipt** button were one box, so the message colour became the button's background. The message and the button are now separate (the same for **Send the missing amount**).

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
