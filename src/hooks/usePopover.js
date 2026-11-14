import { useEffect, useId, useRef, useState } from "react";

/** A list that opens under a button, for the notification bells: it closes on Escape (focus goes back to the button) or when someone clicks
 *  elsewhere, and is placed with `position: fixed` from the button's position so no scrolling box clips it. `align` is the edge of the button it lines up with. */
export function usePopover(align = "left") {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const btn = useRef(null);
  const panel = useRef(null);
  const id = useId();

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = align === "right" ? r.right - width : r.left;
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onDown = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  return { open, toggle, close, btn, panel, pos, id };
}
