import { MEDIA } from "~/lib/breakpoints.js";

const EDITABLE = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea, select, [contenteditable=true]";

/** True (a ref) while the on-screen keyboard is probably open on a phone or tablet: focus is in a text field below 1024px.
 *  (The visual viewport shrinking is a second signal, for browsers that resize on keyboard.) */
export function useKeyboardOpen() {
  const open = ref(false);
  if (typeof window === "undefined") return open;
  const small = () => window.matchMedia?.(MEDIA.bottomNav).matches;
  let t;
  const set = (v) => { clearTimeout(t); t = setTimeout(() => { open.value = v; }, v ? 0 : 120); };
  const onIn = (e) => { if (small() && e.target?.matches?.(EDITABLE)) set(true); };
  const onOut = () => set(false);
  const vv = window.visualViewport;
  const onResize = () => { if (small() && vv && vv.height < window.innerHeight * 0.75) set(true); else if (vv && vv.height >= window.innerHeight * 0.75 && !document.activeElement?.matches?.(EDITABLE)) set(false); };
  document.addEventListener("focusin", onIn);
  document.addEventListener("focusout", onOut);
  vv?.addEventListener("resize", onResize);
  onScopeDispose(() => { clearTimeout(t); document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); vv?.removeEventListener("resize", onResize); });
  return open;
}
