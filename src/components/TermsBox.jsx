import React, { useId, useState } from "react";
import SafeHtml from "./SafeHtml.jsx";

/** The Terms (events.terms_html, sanitized) behind a real button with aria-expanded. */
export default function TermsBox({ event, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!event?.terms_html) return null;
  return (
    <section className="rounded-lg border border-link bg-brand-ivory p-3 text-sm" aria-label="Terms and Conditions">
      <button type="button" className="btn-secondary w-full justify-between" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span>{open ? "Hide" : "Read"} the Terms and Conditions</span><span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      <div id={id} hidden={!open} className="mt-3 border-l-4 border-link pl-4"><SafeHtml html={event.terms_html} /></div>
    </section>
  );
}
