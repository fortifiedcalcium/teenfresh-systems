import React from "react";
import { IconInbox } from "./NavIcons.jsx";
import logoImg from "../logo/teenfresh-logo.png";

export function Spinner({ className = "h-5 w-5" }) {
  return <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-brand-sky border-t-link ${className}`} />;
}

/** Spinner + visible text; the text is the accessible name, so reduced-motion users still see "Loading…".
 *  `logo` makes it a loading screen: the Teenfresh logo (it pulses gently, and stands still for people who ask for less motion)
 *  above the spinner. The logo is decorative: the text already says what is happening. */
export const Loading = ({ label = "Loading…", className = "p-10", logo = false }) => (
  <div role="status" className={`flex ${logo ? "flex-col" : ""} items-center justify-center gap-3 text-ink-muted ${className}`}>
    {logo && <img src={logoImg} alt="" width="188" height="40" className="mb-2 h-10 w-auto motion-safe:animate-pulse" />}
    <span className="flex items-center gap-3"><Spinner /> <span>{label}</span></span>
  </div>
);

export function FullPageSpinner({ label = "Loading…" }) {
  return <div className="flex min-h-screen items-center justify-center"><Loading label={label} logo /></div>;
}

export const Empty = ({ children }) => <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-link bg-white p-8 text-center text-sm text-ink"><span className="text-link"><IconInbox /></span>{children}</div>;
