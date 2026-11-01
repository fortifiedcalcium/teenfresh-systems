import React from "react";
import { IconInbox } from "./NavIcons.jsx";

export function Spinner({ className = "h-5 w-5" }) {
  return <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-brand-sky border-t-link ${className}`} />;
}

/** Spinner + visible text; the text is the accessible name, so reduced-motion users still see "Loading…". */
export const Loading = ({ label = "Loading…", className = "p-10" }) => (
  <div role="status" className={`flex items-center justify-center gap-3 text-ink-muted ${className}`}><Spinner /> <span>{label}</span></div>
);

export function FullPageSpinner({ label = "Loading…" }) {
  return <div className="flex min-h-screen items-center justify-center"><Loading label={label} /></div>;
}

export const Empty = ({ children }) => <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-link bg-white p-8 text-center text-sm text-ink"><span className="text-link"><IconInbox /></span>{children}</div>;
