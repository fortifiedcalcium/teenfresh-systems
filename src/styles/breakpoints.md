# Breakpoints

Mobile first. The numbers live in `src/lib/breakpoints.js` and `tailwind.config.js` (`theme.screens`); `xs` (480) is the only
addition to Tailwind's defaults. Layout is decided by CSS media queries. `useBreakpoint()` / `useMediaQuery()` (matchMedia, SSR-safe,
debounced) is used only where JavaScript has to choose what to render (table rows as cards, the filter sheet, the payments split view).
There is no user-agent sniffing.

| Name | Range (CSS px) | Tailwind | Admin navigation | Content columns | Gutter | Max content width |
|---|---|---|---|---|---|---|
| Small mobile | 320 to 479 | base | Bottom bar (compact) | 4 | 16 | fluid |
| Mobile | 480 to 639 | `xs` | Bottom bar | 4 | 16 | fluid |
| Large mobile | 640 to 767 | `sm` | Bottom bar | 8 | 20 | fluid |
| Tablet portrait | 768 to 1023 | `md` | Bottom bar (floating pill, max 640) | 8 | 24 | 720 |
| Desktop | 1024 to 1279 | `lg` | Sidebar (240, collapsible) | 12 | 24 | 1024 |
| Large desktop | 1280 to 1535 | `xl` | Sidebar (240) | 12 | 32 | 1200 |
| Wide desktop | 1536+ | `2xl` | Sidebar (260) | 12 | 32 | 1360 |

The bottom bar becomes the sidebar at exactly **1024px** (`lg:`). A tablet in landscape (1024 or wider) gets the sidebar; in portrait
it gets the bottom bar. Short landscape phones (`max-height: 480px` and landscape) get a 56px bar with the labels hidden (names kept).

## Bottom bar sizes

| | < 480 | 480 to 767 | 768 to 1023 |
|---|---|---|---|
| Bar height (without safe area) | 64 | 68 | 76 |
| Top corner radius | 20 | 24 | 28 (pill: all corners) |
| Icon / label | 24 / 11 | 24 / 12 | 28 / 14 |
| Scan button diameter / protrusion | 56 / 28 | 60 / 30 | 68 / 34 |

All sizes are CSS variables in `src/styles/admin-nav.css` (`--nav-h`, `--fab-d`, `--fab-up`, `--bottom-nav-h`, `--safe-bottom`), so the bar,
the page padding and the scan button always agree and nothing shifts when the bar mounts.

## Pages

* **Tables** (`DataTable`): below 768 each row is a card; 768 to 1023 shows the first four columns and the actions, with a "Columns" toggle; from 1024 the full table.
* **Filters** (`FilterBar`): below 768 a "Filter (n)" button opens a sheet and the search stays sticky under the top bar; from 768 they sit inline.
* **Dialogs** (`Modal`): full-screen sheets below 768, centred dialogs from 768. Focus trap and Esc are unchanged.
* **Payments**: list of cards on phones with the review as a full-screen sheet (Verify / Underpaid / Reject in a sticky bottom area); from 768 a split view (list 40%, review 60%).
* **Scanner**: the result slides up as a sheet above the bar and the scan button on phones; inline from 768.
* **Dashboard**: 2 stat columns on phones, 4 from 768; charts side by side from 1024.
* **Forms**: one column below 768, two from 768; inputs are 16px and 44px tall on phones.
