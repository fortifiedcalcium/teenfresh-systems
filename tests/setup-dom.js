import { afterEach, expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Shared by every test file. The Node-only tests (schema, merge, contrast) skip the DOM parts.
expect.extend(matchers);

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => cleanup());
  // jsdom has no layout engine; stub the browser APIs the app touches
  // Node can shadow jsdom's localStorage with an unusable global; use a small in-memory one when it is not a working Storage.
  try { window.localStorage.setItem("t", "1"); window.localStorage.removeItem("t"); } catch {
    const mem = new Map();
    Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() } });
  }
  window.scrollTo = () => {};
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}
