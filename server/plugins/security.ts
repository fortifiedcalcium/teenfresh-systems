import { cspFor, inlineScriptHashes, STATIC_SECURITY_HEADERS } from "../utils/security";

// Adds the security headers (and the Content-Security-Policy, with the hashes of this page's inline scripts) to every HTML page.
// Off in development, where Vite writes its own inline scripts.
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return;
  nitroApp.hooks.hook("render:response", async (response) => {
    const type = String(response.headers?.["content-type"] || "");
    if (!type.includes("text/html") || typeof response.body !== "string") return;
    response.headers = {
      ...response.headers, ...STATIC_SECURITY_HEADERS, "cache-control": "no-cache",
      "content-security-policy": cspFor(await inlineScriptHashes(response.body)),
    };
  });
});
