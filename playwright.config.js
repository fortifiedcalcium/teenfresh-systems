import { defineConfig, devices } from "@playwright/test";

const PORT = 5199;
const CSP_PORT = 5198;
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: 1,   // the Nuxt dev server can reload a page once while it warms up on the first requests
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(csp|ssr|tickets|info-rows)/ },
    // The picture-comparison tests run against the production build: the dev server swaps styles and fonts in late, which moves things by a pixel or two.
    { name: "visual", testMatch: /(tickets|info-rows)\.spec\.js/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${CSP_PORT}` } },
    { name: "phone-320", use: { ...devices["Pixel 5"], viewport: { width: 320, height: 640 } }, grep: /reflow|target size/, testIgnore: /(csp|ssr)/ },
    // The security headers (public/_headers) are tested against the real production build, because the dev server uses inline scripts.
    { name: "csp", testMatch: /(csp|ssr)\.spec\.js/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${CSP_PORT}`, permissions: ["camera"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } } },
  ],
  webServer: [
    {
      // The app talks to a fake Supabase (see e2e/fixtures.js), so no backend is needed to run these tests.
      command: `npx nuxt dev --port ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
    },
    {
      // The fake Supabase the SERVER talks to while rendering (the browser tests mock the network inside the browser instead).
      command: "node e2e/fake-supabase.mjs", port: 54321, reuseExistingServer: !process.env.CI,
    },
    {
      // the production build is made first by `npm run test:e2e` (pretest:e2e); here it is only run
      command: `node dist-csp/server/index.mjs`,
      port: CSP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: String(CSP_PORT), NITRO_PORT: String(CSP_PORT) },
    },
  ],
});
