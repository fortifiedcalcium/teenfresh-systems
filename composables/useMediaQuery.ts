import { MEDIA } from "~/lib/breakpoints";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** matchMedia as a ref. False on the server and when matchMedia is missing, and debounced, so a window drag does not update on
 *  every pixel. CSS does the layout; use this only where JS must choose what to render. */
export function useMediaQuery(query, delay = 80) {
  const matches = ref(supported() ? window.matchMedia(query).matches : false);
  if (!supported()) return matches;
  const mq = window.matchMedia(query);
  let t;
  const update = () => { clearTimeout(t); t = setTimeout(() => { matches.value = mq.matches; }, delay); };
  mq.addEventListener?.("change", update);
  onScopeDispose(() => { clearTimeout(t); mq.removeEventListener?.("change", update); });
  return matches;
}

/** { isMobile (<768), isTablet (768-1023), isDesktop (>=1024), bottomNav (<1024), shortLandscape } as refs */
export function useBreakpoint() {
  const isMobile = useMediaQuery(MEDIA.mobile);
  const isTablet = useMediaQuery(MEDIA.tablet);
  const isDesktop = useMediaQuery(MEDIA.desktop);
  const shortLandscape = useMediaQuery(MEDIA.shortLandscape);
  return { isMobile, isTablet, isDesktop, bottomNav: computed(() => !isDesktop.value), shortLandscape };
}
