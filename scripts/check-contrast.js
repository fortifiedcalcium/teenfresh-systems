#!/usr/bin/env node
// Fails (exit 1) if any approved colour pairing drops below its WCAG ratio, if a forbidden pairing is used,
// if a brand colour is used as text, or if a hex value appears outside src/styles/tokens.css. Runs before `npm run build`.
import { checkTokens, scanSource } from "./contrast.js";

const { failures, results } = checkTokens();

if (process.argv.includes("--markdown")) {
  console.log("| Foreground | Background | Ratio | Needs | Use |\n|---|---|---|---|---|");
  for (const r of results) console.log(`| \`${r.fg}\` | \`${r.bg}\` | ${r.ratio.toFixed(2)} | ${r.forbidden ? "fails (<4.5), forbidden as text" : r.min + ":1"} | ${r.use} |`);
  process.exit(0);
}
const scan = scanSource();
const pad = (s, n) => String(s).padEnd(n);

console.log("\nTeenfresh colour contrast (WCAG 2.2)\n");
console.log(pad("foreground", 13) + pad("background", 13) + pad("ratio", 8) + pad("needs", 7) + "result  use");
for (const r of results) console.log(pad(r.fg, 13) + pad(r.bg, 13) + pad(r.ratio.toFixed(2), 8) + pad(r.forbidden ? "<4.5" : r.min, 7) + pad(r.ok ? "pass" : "FAIL", 8) + r.use);
const all = [...failures, ...scan.failures];
console.log(`\nScanned ${scan.files} source files.`);
if (all.length) { console.error("\nContrast check FAILED:\n - " + all.join("\n - ")); process.exit(1); }
console.log("All contrast checks passed.\n");
