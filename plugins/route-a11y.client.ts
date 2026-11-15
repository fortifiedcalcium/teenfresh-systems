import { titleFor } from "~/lib/titles";

// On every route change: move focus to the page's h1 (or <main>) and announce the page.
// The unique <title> comes from app.vue (by route) or from the page itself (useSeo). Skipped on first load so the browser keeps its normal behaviour.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const announce = useAnnounce();
  const seoTitle = useState("seo-title", () => "");   // a page that names itself (an event, a product) sets this through useSeo
  router.beforeEach(() => { seoTitle.value = ""; });   // before every navigation: the next page sets it again if it names itself
  // the page is interactive (hydrated): server-rendered pages can be clicked a moment before that, and tests wait for this mark
  nuxtApp.hook("app:mounted", () => { document.documentElement.dataset.hydrated = "true"; });
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: string | null = null;   // set by a real navigation (not the first load, not a change of only the query); handled once the new page has been drawn
  router.afterEach((to, from) => { pending = from.matched.length === 0 || to.path === from.path ? null : to.path; });
  nuxtApp.hook("page:finish", () => {
    const path = pending;
    pending = null;
    if (!path) return;   // the first load keeps the browser's normal behaviour
    clearInterval(timer);
    let tries = 0;
    // pages load their data asynchronously, so wait briefly for the h1 to exist
    timer = setInterval(() => {
      const target = document.querySelector("main h1") || (tries > 8 ? document.querySelector("main") : null);
      tries++;
      if (target || tries > 10) {
        clearInterval(timer);
        if (target) { target.setAttribute("tabindex", "-1"); (target as HTMLElement).focus({ preventScroll: false }); }
        announce(seoTitle.value || titleFor(path));
      }
    }, 100);
  });
});
