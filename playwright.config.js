import { defineConfig, devices } from "@playwright/test";

const PORT = 5199;
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone-320", use: { ...devices["Pixel 5"], viewport: { width: 320, height: 640 } }, grep: /reflow|target size/ },
  ],
  webServer: {
    // The app talks to a fake Supabase (see e2e/fixtures.js), so no backend is needed to run these tests.
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
  },
});
