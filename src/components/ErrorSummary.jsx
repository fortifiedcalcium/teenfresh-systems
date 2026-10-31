import React, { useEffect, useRef, useState } from "react";

/** [signal, bump]: call bump() from a form's "invalid submit" handler so the summary takes focus. */
export function useErrorFocus() {
  const [signal, set] = useState(0);
  return [signal, () => set((n) => n + 1)];
}

/** 3.3.1 / 3.3.3: a summary of every error at the top of the form, each item linking to its field.
 *  It appears, and takes focus, only after a SUBMIT FAILS (the form calls bump() from useErrorFocus): never because errors
 *  changed while someone was typing, which stole focus and announced itself as an alert on every keystroke.
 *  Give it a `key` that changes per step so each step starts with no summary. `labels` maps field name -> visible label. */
export default function ErrorSummary({ errors, labels = {}, focusSignal = 0, fieldIds = {}, extra }) {
  const ref = useRef(null);
  const seen = useRef(focusSignal);      // the signal value when this summary was created: not a failed submit
  const pending = useRef(false);
  const [armed, setArmed] = useState(false);
  const items = Object.entries(errors).map(([name, e]) => ({ name, message: e?.message })).filter((i) => i.message);
  if (extra) items.unshift({ name: "_extra", message: extra });

  useEffect(() => { if (focusSignal !== seen.current) { seen.current = focusSignal; pending.current = true; setArmed(true); } }, [focusSignal]);
  // the form library reports "invalid" before it publishes the errors, so wait until the summary really exists, then focus it once
  useEffect(() => { if (pending.current && ref.current) { pending.current = false; ref.current.focus(); } });
  // a problem only the server can find (wrong password, X username taken ...) arrives after the submit: focus it once
  useEffect(() => { if (extra) ref.current?.focus(); }, [extra]);

  if (!items.length || !(armed || extra)) return null;

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
