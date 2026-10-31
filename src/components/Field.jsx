import React from "react";

/** Visible label, "(required)" text, hint and error wired together for screen readers (3.3.2, 1.3.1, 3.3.1).
 *  `children` must be a single form control; it receives id and the aria attributes. */
export default function Field({ label, error, hint, id, required, children }) {
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="font-normal text-ink-muted"> (required)</span>}</label>
      {React.cloneElement(children, { id, "aria-invalid": error ? "true" : undefined, "aria-describedby": describedBy, "aria-required": required ? "true" : undefined })}
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{error}</p>}
    </div>
  );
}
