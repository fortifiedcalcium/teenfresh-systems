import React, { useRef } from "react";
import SafeHtml from "./SafeHtml.jsx";

const BUTTONS = [
  ["Bold", (t) => `<strong>${t || "bold text"}</strong>`],
  ["Italic", (t) => `<em>${t || "italic text"}</em>`],
  ["Paragraph", (t) => `<p>${t || "Paragraph"}</p>`],
  ["Numbered list", (t) => `<ol>\n<li>${t || "First rule"}</li>\n<li>Second rule</li>\n</ol>`],
  ["Link", (t) => `<a href="https://">${t || "link text"}</a>`],
];

/** A small HTML editor for the Terms: formatting buttons wrap the selection in the right tag, and a live preview shows
 *  exactly what attendees will see (the same sanitizer is used for the page and the email, so scripts and styles never get through). */
export default function TermsEditor({ id, value, onChange }) {
  const ref = useRef(null);
  const apply = (make) => {
    const el = ref.current;
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const text = value.slice(s, e);
    const next = value.slice(0, s) + make(text) + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); });
  };
  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap gap-2">
        {BUTTONS.map(([label, make]) => <button key={label} type="button" className="btn-secondary" onClick={() => apply(make)}>{label}</button>)}
      </div>
      <textarea id={id} ref={ref} rows={12} className="input font-mono text-sm" value={value} onChange={(e) => onChange(e.target.value)} spellCheck />
      <div>
        <p className="label">Preview (what attendees see)</p>
        <div className="rounded-lg border border-link bg-brand-ivory p-3 text-sm"><SafeHtml html={value} /></div>
      </div>
    </div>
  );
}
