import { titleFor } from "~/lib/titles.js";

// On every route change: move focus to the page's h1 (or <main>) and announce the page.
// The unique <title> comes from app.vue (by route) or from the page itself (useSeo). Skipped on first load so the browser keeps its normal behaviour.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const announce = useAnnounce();
  const seoTitle = useState("seo-title", () => "");   // a page that names itself (an event, a product) sets this through useSeo
  router.beforeEach(() => { seoTitle.value = ""; });   // before every navigation: the next page sets it again if it names itself
  let prev = null; // last pathname handled; null until the first load
  let timer = null;
  const handle = (pathname) => {
    const title = seoTitle.value || titleFor(pathname);
    if (prev === null || prev === pathname) { prev = pathname; return; }
    prev = pathname;
    clearInterval(timer);
    let tries = 0;
    // pages load their data asynchronously, so wait briefly for the h1 to exist
    timer = setInterval(() => {
      const target = document.querySelector("main h1") || (tries > 8 ? document.querySelector("main") : null);
      tries++;
      if (target || tries > 10) {
        clearInterval(timer);
        if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: false }); }
        announce(title);
      }
    }, 100);
  };
  nuxtApp.hook("page:finish", () => handle(router.currentRoute.value.path));
});
