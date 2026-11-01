/** Single source of truth for the responsive breakpoints (min-width, CSS px). tailwind.config.js uses the same numbers
 *  (xs is the only addition to Tailwind's defaults). Documented in src/styles/breakpoints.md. */
export const BREAKPOINTS = { xs: 480, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };

/** Admin navigation switches from the bottom bar to the sidebar at exactly this width. Pure CSS (`lg:`), so a tablet in
 *  landscape (1024 or wider) gets the sidebar and a tablet in portrait gets the bottom bar. No user-agent sniffing. */
export const NAV_SWITCH = BREAKPOINTS.lg;

export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,                                    // 0-767: cards, sheets, one column
  tablet: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`, // 768-1023: bottom bar (pill), compact tables
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,                                        // 1024+: sidebar, full tables
  fromTablet: `(min-width: ${BREAKPOINTS.md}px)`,
  bottomNav: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  shortLandscape: "(max-height: 480px) and (orientation: landscape)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
};

/** Name of the range a width falls in (used by tests and docs). */
export function rangeName(width) {
  if (width < BREAKPOINTS.xs) return "small mobile";
  if (width < BREAKPOINTS.sm) return "mobile";
  if (width < BREAKPOINTS.md) return "large mobile";
  if (width < BREAKPOINTS.lg) return "tablet portrait";
  if (width < BREAKPOINTS.xl) return "desktop";
  if (width < BREAKPOINTS["2xl"]) return "large desktop";
  return "wide desktop";
}
