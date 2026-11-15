// After `nuxt generate`: finds the inline <script> blocks in dist/index.html and allows exactly those (by sha256) in the CSP.
import { createHash } from "node:crypto";
import fs from "node:fs";

const dist = process.argv[2] || "dist";
const html = fs.readFileSync(`${dist}/index.html`, "utf8");
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/json|importmap|speculationrules)")[^>]*>([\s\S]*?)<\/script>/g)]
  .filter((m) => m[1].trim())
  .map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
const src = ["'self'", ...new Set(hashes)].join(" ");
const headers = fs.readFileSync(`${dist}/_headers`, "utf8").replaceAll("__SCRIPT_SRC__", src);
fs.writeFileSync(`${dist}/_headers`, headers);
// Cloudflare Pages treats a 404.html as "no SPA fallback"; the app has its own not-found handling.
fs.rmSync(`${dist}/404.html`, { force: true });
console.log(`CSP: ${hashes.length} inline script hash(es) added to ${dist}/_headers`);
