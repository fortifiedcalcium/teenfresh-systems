/** @type {import('tailwindcss').Config} */
// Colours map to the CSS variables in src/styles/tokens.css, the only place hex values live.
const v = (name) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // Default Tailwind breakpoints plus xs (480). Keep in sync with src/lib/breakpoints.js and src/styles/breakpoints.md.
    screens: { xs: "480px", sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    // Body text is never below 14px; most UI text is 16px (WCAG 1.4.4 / readability).
    fontSize: {
      xs: ["0.875rem", { lineHeight: "1.5" }],
      sm: ["1rem", { lineHeight: "1.5" }],
      base: ["1rem", { lineHeight: "1.5" }],
      lg: ["1.125rem", { lineHeight: "1.5" }],
      xl: ["1.25rem", { lineHeight: "1.4" }],
      "2xl": ["1.5rem", { lineHeight: "1.3" }],
      "3xl": ["1.875rem", { lineHeight: "1.25" }],
      "4xl": ["2.25rem", { lineHeight: "1.2" }],
      "5xl": ["3rem", { lineHeight: "1.1" }],
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: v("white"),
      ink: { DEFAULT: v("ink"), muted: v("ink-muted") },
      link: v("link"),
      danger: v("danger"),
      success: v("success"),
      "warning-ink": v("warning-ink"),
      brand: {
        cream: v("brand-cream"), blue: v("brand-blue"), coral: v("brand-coral"),
        ivory: v("brand-ivory"), sky: v("brand-sky"), blush: v("brand-blush"), mint: v("brand-mint"),
      },
    },
    extend: {
      fontFamily: { sans: ['"Source Sans 3"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] },
      minHeight: { target: "2.75rem" }, // 44px touch target
      minWidth: { target: "2.75rem" },
    },
  },
  plugins: [],
};
