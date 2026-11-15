import { titleFor } from "~/lib/titles.js";

// On every route change: set a unique <title>, move focus to the page's h1 (or <main>) and announce the page.
// Skipped on first load so the browser keeps its normal behaviour.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const announce = useAnnounce();
  let prev = null; // last pathname handled; null until the first load
  let timer = null;
  const handle = (pathname) => {
    const title = titleFor(pathname);
    document.title = `${title} · Teenfresh Events`;
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
