// Visitors cannot right-click, drag or long-press to save the pictures on the public pages. This only discourages casual saving: anyone can still
// get a picture through the browser's own tools, so it is a courtesy to the people whose pictures these are, not security.
// Left alone on purpose: the GCash QR codes (people save them to scan in the GCash app) and a person's own receipt (both carry data-allow-save),
// every image outside the public layout (the admin area), and keyboards, screen readers and links, which are not touched.
export default defineNuxtPlugin(() => {
  const protectedImage = (t: EventTarget | null): boolean => {
    const el = t instanceof Element ? t : null;
    const img = el?.closest("img");
    return !!img && !!img.closest(".no-save") && !img.closest("[data-allow-save]");
  };
  document.addEventListener("contextmenu", (e) => { if (protectedImage(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (protectedImage(e.target)) e.preventDefault(); });
});
