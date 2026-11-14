import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loading } from "./Spinner.jsx";

/** A screen over the whole page while something that must not be interrupted is running (for example sending an email).
 *  It blocks clicks, tells screen readers what is happening, and warns before the tab is closed or reloaded. */
export default function BusyOverlay({ show, label = "Please wait…" }) {
  useEffect(() => {
    if (!show) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [show]);
  if (!show) return null;
  return createPortal(
    <div className="busy-overlay" aria-busy="true">
      <div className="busy-card">
        <Loading label={label} className="p-0 text-ink" />
        <p className="mt-2 text-sm text-ink-muted">Please wait. Do not close or leave this page.</p>
      </div>
    </div>,
    document.body,
  );
}
