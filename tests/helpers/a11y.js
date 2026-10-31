import { axe } from "vitest-axe";

// WCAG 2.0/2.1/2.2 A + AA plus best practices. Two rules are off in jsdom: colour contrast (no layout engine:
// covered by scripts/check-contrast.js and the Playwright run) and `region` (page landmarks come from the layouts,
// checked in the Playwright run and the layout tests).
export const AXE_OPTIONS = {
  iframes: false, // the email preview iframe is sandboxed and titled; jsdom cannot message into frames
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
};
export const check = (container) => axe(container, AXE_OPTIONS);
