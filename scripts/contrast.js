// WCAG 2.x contrast maths and the token checks. Used by scripts/check-contrast.js (build) and tests/contrast.test.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readTokens() {
  const css = fs.readFileSync(path.join(ROOT, "src/styles/tokens.css"), "utf8");
  const tokens = {};
  for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}

const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const luminance = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** The Teenfresh brand guide values. The script fails if tokens.css drifts from them. */
export const BRAND = { "brand-cream": "#f9e7b9", "brand-blue": "#65a6d0", "brand-coral": "#ec9697", "brand-ivory": "#fcf7e3", "brand-sky": "#c4d6ea", "brand-blush": "#f1d0d9", "brand-mint": "#dfecde" };

// kind: "text" needs 4.5, "ui" (borders, icons, focus rings, progress fill, chart marks) needs 3. "text7" = AAA body-text target (reported, not enforced).
const T = (fg, bg, min = 4.5, use = "") => ({ fg, bg, min, use });
export const APPROVED = [
  // primary text
  ...["white", "brand-ivory", "brand-cream", "brand-mint", "brand-blush", "brand-sky", "brand-coral", "brand-blue"].map((bg) => T("ink", bg, 4.5, "body text")),
  // secondary text (never on blue or coral)
  ...["white", "brand-ivory", "brand-cream", "brand-sky", "brand-mint", "brand-blush"].map((bg) => T("ink-muted", bg, 4.5, "secondary / helper text")),
  // links
  ...["white", "brand-ivory", "brand-cream", "brand-sky", "brand-blush", "brand-mint"].map((bg) => T("link", bg, 4.5, "links")),
  // status text
  T("danger", "white", 4.5, "error text"), T("danger", "brand-ivory"), T("danger", "brand-blush", 4.5, "sold out / invalid / alert"), T("danger", "brand-cream"),
  T("success", "white", 4.5, "success text"), T("success", "brand-mint", 4.5, "available / valid"), T("success", "brand-ivory"),
  T("success", "brand-blush", 4.5, "text on the page background"), T("warning-ink", "brand-blush", 4.5, "text on the page background"),
  T("warning-ink", "brand-cream", 4.5, "few slots / already checked in"), T("warning-ink", "white"), T("warning-ink", "brand-ivory"),
  // inverted
  T("white", "danger", 4.5, "destructive button"), T("brand-ivory", "ink", 4.5, "hover / current nav"), T("white", "link", 4.5, "text on link fill"),
  // admin bottom navigation (cream bar like the sidebar): inactive ink on cream, active ivory on the ink pill
  T("ink", "brand-cream", 4.5, "bottom bar: inactive label"), T("brand-ivory", "ink", 4.5, "bottom bar: active label on the ink pill"), T("ink", "brand-sky", 4.5, "bottom bar: pressed item"),
  T("ink", "brand-cream", 3, "bottom bar: inactive icon"), T("brand-ivory", "ink", 3, "bottom bar: active icon"),
  T("ink", "brand-blue", 4.5, "scan button icon on its fill"), T("brand-ivory", "ink", 4.5, "bottom bar: focus ring and text"), T("ink", "brand-coral", 4.5, "pending badge"),
  // non-text (>= 3:1)
  T("link", "white", 3, "input / card border"), T("link", "brand-ivory", 3, "border"), T("link", "brand-sky", 3, "progress fill on track"),
  T("ink", "white", 3, "focus ring"), T("ink", "brand-ivory", 3, "focus ring"), T("ink", "brand-cream", 3, "focus ring"), T("ink", "brand-sky", 3, "focus ring"), T("ink", "brand-blush", 3, "focus ring on the page background"), T("link", "brand-blush", 3, "border / icon on the page background"),
  T("ink", "brand-blue", 3, "button outline / chart outline"), T("ink", "brand-coral", 3, "chart outline"), T("brand-ivory", "ink", 3, "focus ring on ink surfaces"),
  T("danger", "white", 3, "invalid input border"), T("success", "brand-mint", 3, "alert bar"), T("warning-ink", "brand-cream", 3, "alert bar"), T("danger", "brand-blush", 3, "alert bar"),
];

/** Pairings the add-on forbids as text. They must stay below 4.5:1 (proving why) and must never appear in the source. */
export const FORBIDDEN = [
  ["brand-blue", "white"], ["brand-coral", "white"], ["brand-blue", "brand-cream"], ["brand-cream", "white"], ["brand-sky", "white"],
  ["link", "brand-blue"], ["link", "brand-coral"], ["danger", "brand-blue"], ["danger", "brand-coral"], ["ink-muted", "brand-blue"],
];

/** Class-name -> token, so the source scan can reason about Tailwind classes. */
const CLASS_TOKEN = { ink: "ink", "ink-muted": "ink-muted", link: "link", danger: "danger", success: "success", "warning-ink": "warning-ink", white: "white",
  "brand-cream": "brand-cream", "brand-blue": "brand-blue", "brand-coral": "brand-coral", "brand-ivory": "brand-ivory", "brand-sky": "brand-sky", "brand-blush": "brand-blush", "brand-mint": "brand-mint" };

export function checkTokens() {
  const tokens = readTokens();
  const failures = [], results = [];
  for (const [k, v] of Object.entries(BRAND)) if (tokens[k] !== v) failures.push(`brand token --${k} is ${tokens[k]}, the brand guide says ${v}`);
  for (const name of ["ink", "ink-muted", "link", "danger", "success", "warning-ink", "white"]) if (!tokens[name]) failures.push(`missing token --${name}`);
  const get = (n) => tokens[n];
  for (const p of APPROVED) {
    if (!get(p.fg) || !get(p.bg)) { failures.push(`unknown token in pair ${p.fg}/${p.bg}`); continue; }
    const r = ratio(get(p.fg), get(p.bg));
    results.push({ ...p, ratio: r, ok: r >= p.min });
    if (r < p.min) failures.push(`${p.fg} on ${p.bg} is ${r.toFixed(2)}:1, needs ${p.min}:1 (${p.use})`);
  }
  for (const [fg, bg] of FORBIDDEN) {
    const r = ratio(get(fg), get(bg));
    if (r >= 4.5) failures.push(`forbidden pairing ${fg} on ${bg} now passes (${r.toFixed(2)}); the rule list is stale`);
    results.push({ fg, bg, min: 4.5, ratio: r, ok: r < 4.5, use: "FORBIDDEN as text", forbidden: true });
  }
  return { failures, results, tokens };
}

/* ---------- source scan ---------- */
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else if (/\.(jsx?|css)$/.test(f.name)) out.push(p);
  }
  return out;
}

/** Looks at every string of Tailwind classes (className="...", template literals, @apply lines) that sets both a
 *  background and a text colour, and checks that pair. Also forbids brand colours as text and stray hex values. */
export function scanSource() {
  const { tokens } = checkTokens();
  const failures = [];
  const files = walk(path.join(ROOT, "src"));
  const HEX_ALLOW = [/styles[\\/]tokens\.css$/, /AuthShell\.jsx$/]; // AuthShell: the multicolour Google "G" logo (third-party trademark colours)
  const chunks = (text) => [...text.matchAll(/(?:className=(?:"([^"]*)"|\{`([^`]*)`\})|@apply ([^;]+);|"([^"\n]*(?:bg|text)-[^"\n]*)")/g)].map((m) => m[1] || m[2] || m[3] || m[4] || "");

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    if (!HEX_ALLOW.some((re) => re.test(file))) {
      const m = text.match(/#[0-9a-fA-F]{6}\b/); // 6-digit hex literals only (anchors like #main-content are not colours)
      if (m) failures.push(`${rel}: hard-coded colour ${m[0]} (use a token from tokens.css)`);
    }
    for (const chunk of chunks(text)) {
      const classes = chunk.split(/\s+/).filter(Boolean);
      // Brand colours are surfaces. The one approved exception: ivory (or cream) text on an ink fill.
      for (const c of classes) {
        const m = c.match(/^((?:[a-z-]+:)*)text-(brand-[a-z]+)$/);
        if (!m) continue;
        const onInk = classes.includes(`${m[1]}bg-ink`) && ["brand-ivory", "brand-cream"].includes(m[2]);
        if (!onInk) failures.push(`${rel}: "${c}" uses a brand colour as text colour`);
      }
      // evaluate each state (base, hover:) separately
      const state = (prefix) => {
        const pick = (kind) => classes.map((c) => c.match(new RegExp(`^${prefix}${kind}-(.+)$`))).filter(Boolean).map((m) => m[1]).filter((n) => CLASS_TOKEN[n]);
        return { bg: pick("bg"), fg: pick("text") };
      };
      for (const prefix of ["", "hover:", "active:"]) {
        const { bg, fg } = state(prefix);
        if (!bg.length || !fg.length) continue;
        const r = ratio(tokens[CLASS_TOKEN[fg[0]]], tokens[CLASS_TOKEN[bg[0]]]);
        if (r < 4.5) failures.push(`${rel}: ${prefix}text-${fg[0]} on ${prefix}bg-${bg[0]} is ${r.toFixed(2)}:1 (needs 4.5:1) in "${chunk.slice(0, 80)}"`);
        if (FORBIDDEN.some(([f, b]) => f === CLASS_TOKEN[fg[0]] && b === CLASS_TOKEN[bg[0]])) failures.push(`${rel}: forbidden pairing ${fg[0]} on ${bg[0]}`);
      }
    }
  }
  return { failures, files: files.length };
}
