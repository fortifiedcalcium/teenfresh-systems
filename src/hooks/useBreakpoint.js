import { useEffect, useState } from "react";
import { MEDIA } from "../lib/breakpoints.js";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** matchMedia as state. SSR-safe (false on the server and when matchMedia is missing, e.g. jsdom) and debounced, so a
 *  window drag does not re-render on every pixel. CSS does the layout; use this only where JS must choose what to render. */
export function useMediaQuery(query, delay = 80) {
  const [matches, setMatches] = useState(() => (supported() ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported()) return undefined;
    const mq = window.matchMedia(query);
    let t;
    const update = () => { clearTimeout(t); t = setTimeout(() => setMatches(mq.matches), delay); };
    setMatches(mq.matches);
    mq.addEventListener?.("change", update);
    return () => { clearTimeout(t); mq.removeEventListener?.("change", update); };
  }, [query, delay]);
  return matches;
}

/** { isMobile (<768), isTablet (768-1023), isDesktop (>=1024), bottomNav (<1024), shortLandscape } */
export function useBreakpoint() {
  const isMobile = useMediaQuery(MEDIA.mobile);
  const isTablet = useMediaQuery(MEDIA.tablet);
  const isDesktop = useMediaQuery(MEDIA.desktop);
  const shortLandscape = useMediaQuery(MEDIA.shortLandscape);
  return { isMobile, isTablet, isDesktop, bottomNav: !isDesktop, shortLandscape };
}
