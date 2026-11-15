// Shared by the unit tests. They cover the plain logic (lib/); the screens are covered by the Playwright run (e2e/).
// In the jsdom files, Node can shadow jsdom's localStorage with an unusable global: use a small in-memory one when it is not a working Storage.
if (typeof window !== "undefined") {
  try { window.localStorage.setItem("t", "1"); window.localStorage.removeItem("t"); } catch {
    const mem = new Map();
    Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() } });
  }
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
}
