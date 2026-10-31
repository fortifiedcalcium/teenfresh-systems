import { afterEach, expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Shared by every test file. The Node-only tests (schema, merge, contrast) skip the DOM parts.
expect.extend(matchers);

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => cleanup());
  // jsdom has no layout engine; stub the browser APIs the app touches
  window.scrollTo = () => {};
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}
