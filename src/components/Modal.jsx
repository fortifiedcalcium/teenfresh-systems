import React, { useEffect, useId, useRef, useState } from "react";
import { IconClose } from "./NavIcons.jsx";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

// Dialogs can open on top of each other (review dialog -> confirm dialog): only the top one reacts to Esc and Tab.
// Order comes from render order (a dialog rendered inside another renders later), not from effect order.
const stack = [];
let seq = 0;

/** Accessible dialog: labelled by its heading, focus moves in and is trapped, Esc closes, focus returns to the trigger. */
export default function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  const [order] = useState(() => ++seq);
  // Callers pass an inline onClose, which is a new function on every render. If it were an effect dependency the effect
  // would re-run on every keystroke, move focus back to the first control and return focus to the opener, so only one
  // character could be typed at a time. Keep the latest onClose in a ref instead and set the dialog up once.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const opener = document.activeElement; // restored on close
    const box = ref.current;
    const me = { order };
    stack.push(me);
    (box.querySelector("[data-autofocus]") || box.querySelector(FOCUSABLE) || box).focus();
    const onKey = (e) => {
      if (Math.max(...stack.map((m) => m.order)) !== order) return;
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const els = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { stack.splice(stack.indexOf(me), 1); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [order]);

  return (
    <div role="presentation" className="overlay fixed inset-0 z-40 flex items-stretch justify-center md:items-center md:p-4" onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`modal-panel h-[100vh] h-dvh w-full overflow-y-auto border-link bg-white p-5 pb-[calc(1.25rem+var(--safe-bottom))] pt-[calc(0.75rem+var(--safe-top))] md:h-auto md:max-h-[92vh] md:rounded-2xl md:border md:pb-5 md:pt-5 ${wide ? "md:max-w-3xl" : "md:max-w-lg"}`}>
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-brand-sky md:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-black">{title}</h2>
          <button className="btn-secondary" onClick={onClose} aria-label={`Close dialog: ${title}`}><IconClose /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
