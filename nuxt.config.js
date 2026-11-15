// A single-page app (no server rendering): the same shape as the React version, hosted as static files on Cloudflare Pages.
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  ssr: false,
  devtools: { enabled: false },
  modules: ["@nuxt/eslint", "@nuxtjs/tailwindcss"],
  eslint: { config: { stylistic: false } },
  components: [{ path: "~/components", pathPrefix: false }],   // <AdminSidebar /> comes from components/admin/AdminSidebar.vue
  css: ["~/assets/css/main.css"],
  tailwindcss: { cssPath: false, configPath: "tailwind.config.js" },   // main.css has its own @tailwind lines
  // Same names as the React build, so an existing .env keeps working.
  vite: { envPrefix: ["VITE_"], optimizeDeps: { include: ["@supabase/supabase-js", "dompurify", "zod", "qrcode-generator", "html5-qrcode", "exceljs"] } },   // pre-bundled, so the dev server does not reload the page the first time a screen needs one
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
  // Prerender only the shell ("/"), not one folder per route: hosts then serve every route from index.html (see public/_redirects) with no /login -> /login/ redirect.
  nitro: { prerender: { crawlLinks: false, routes: ["/"], failOnError: false }, output: { dir: process.env.NUXT_OUTPUT_DIR || ".output", publicDir: `${process.env.NUXT_OUTPUT_DIR || ".output"}/public` } },
});
