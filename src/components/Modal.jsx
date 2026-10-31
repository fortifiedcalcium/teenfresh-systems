import React, { useEffect, useId, useRef, useState } from "react";

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
  useEffect(() => {
    const opener = document.activeElement; // restored on close
    const box = ref.current;
    const me = { order };
    stack.push(me);
    (box.querySelector("[data-autofocus]") || box.querySelector(FOCUSABLE) || box).focus();
    const onKey = (e) => {
      if (Math.max(...stack.map((m) => m.order)) !== order) return;
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
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
  }, [onClose, order]);

  return (
    <div role="presentation" className="overlay fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-link bg-white p-5 sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button className="btn-secondary" onClick={onClose} aria-label={`Close dialog: ${title}`}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
