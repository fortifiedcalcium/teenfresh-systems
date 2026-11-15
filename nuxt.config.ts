// A single-page app (no server rendering): the same shape as the React version, hosted as static files on Cloudflare Pages.
export default defineNuxtConfig({
  // Type-checked with `npm run typecheck`, but not strict: the project grew from plain JavaScript, so values are checked where they are annotated.
  typescript: { strict: false, typeCheck: false, tsConfig: { compilerOptions: { allowImportingTsExtensions: true, noEmit: true }, exclude: ["../supabase/functions/send-*/**", "../supabase/functions/_shared/send.ts", "../supabase/functions/_shared/mailer.ts", "../supabase/functions/_shared/cors.ts"] } },
  compatibilityDate: "2025-01-01",
  // Public pages (events, shop) are rendered on the server so search engines and link previews see their content; everything that needs
  // the signed-in person (account, cart, checkout, admin) is drawn in the browser.
  ssr: true,
  routeRules: {
    "/admin/**": { ssr: false }, "/login": { ssr: false }, "/register": { ssr: false }, "/forgot-password": { ssr: false }, "/reset-password": { ssr: false },
    "/auth/**": { ssr: false }, "/cart": { ssr: false }, "/checkout": { ssr: false }, "/orders/**": { ssr: false }, "/my-orders": { ssr: false },
    "/my-registrations": { ssr: false }, "/my-ticket/**": { ssr: false }, "/events/*/register": { ssr: false }, "/styleguide": { ssr: false },
  },
  features: { inlineStyles: false },   // the CSP allows styles only from the site's own files
  devtools: { enabled: false },
  modules: ["@nuxt/eslint", "@pinia/nuxt", "@nuxtjs/tailwindcss"],
  eslint: { config: { stylistic: false } },
  runtimeConfig: { public: { siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "https://teenfresh.pages.dev", supabaseUrl: process.env.VITE_SUPABASE_URL || "", supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || "" } },   // the same public values the browser uses; the server reads them for the sitemap
  components: [{ path: "~/components", pathPrefix: false }],   // <AdminSidebar /> comes from components/admin/AdminSidebar.vue
  css: ["~/assets/css/main.css"],
  tailwindcss: { cssPath: false, configPath: "tailwind.config.js" },   // main.css has its own @tailwind lines
  // Same names as the React build, so an existing .env keeps working.
  vite: { envPrefix: ["VITE_"], optimizeDeps: { entries: ["pages/**/*.vue", "layouts/**/*.vue", "components/**/*.vue", "composables/**/*.ts", "stores/**/*.ts", "plugins/**/*.ts", "lib/**/*.ts"], include: ["@supabase/supabase-js", "dompurify", "zod", "qrcode-generator", "html5-qrcode", "exceljs"] } },   // pre-bundled, so the dev server does not reload the page the first time a screen needs one
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "Teenfresh Events",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#f1d0d9" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
      ],
      link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
    },
  },
  // The production build can be made in separate folders (NUXT_BUILD_DIR / NUXT_OUTPUT_DIR), so a test build and the dev server never share files.
  buildDir: process.env.NUXT_BUILD_DIR || ".nuxt",
  // Built for Cloudflare Pages (NITRO_PRESET=cloudflare-pages, see `npm run build`); the tests build for plain Node.
  nitro: { preset: process.env.NITRO_PRESET || "node-server", ...(process.env.NUXT_OUTPUT_DIR ? { output: { dir: process.env.NUXT_OUTPUT_DIR, publicDir: `${process.env.NUXT_OUTPUT_DIR}/public` } } : {}) },
});
