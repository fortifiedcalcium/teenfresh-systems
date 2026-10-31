import React, { useEffect, useRef } from "react";

/** 3.3.1 / 3.3.3: a summary of every error at the top of the form. It takes focus after a failed submit,
 *  and each item links to its field. `labels` maps field name -> visible label. */
export default function ErrorSummary({ errors, labels = {}, submitCount, fieldIds = {}, extra }) {
  const ref = useRef(null);
  const items = Object.entries(errors).map(([name, e]) => ({ name, message: e?.message })).filter((i) => i.message);
  if (extra) items.unshift({ name: "_extra", message: extra });

  // Move focus once per failed submit. Errors can arrive a render after submitCount, so this also depends on items.length.
  const focusedFor = useRef(0);
  useEffect(() => {
    if (submitCount > focusedFor.current && items.length) { focusedFor.current = submitCount; ref.current?.focus(); }
  }, [submitCount, items.length]);
  if (!items.length || submitCount === 0) return null;

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="alert alert-bad block" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title" className="text-base font-bold text-danger">There {items.length === 1 ? "is 1 problem" : `are ${items.length} problems`} with your submission</h2>
      <ul className="mt-1 list-disc pl-5">
        {items.map((i) => (
          <li key={i.name}>
            {i.name === "_extra" ? i.message : <a href={`#${fieldIds[i.name] || i.name}`} onClick={(e) => { e.preventDefault(); document.getElementById(fieldIds[i.name] || i.name)?.focus(); }}>{labels[i.name] ? `${labels[i.name]}: ` : ""}{i.message}</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
