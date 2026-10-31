import React from "react";
import { Link } from "react-router-dom";
import { SkipLink } from "../../a11y.jsx";
import logo from "../../logo/teenfresh-logo.png";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <>
      <SkipLink />
    <div className="flex min-h-screen items-center justify-center bg-brand-blush px-4 py-10">
      <main id="main-content" tabIndex={-1} className="card w-full max-w-md p-6">
        <Link to="/" className="mb-4 flex min-h-target items-center justify-center" aria-label="Teenfresh Events, home"><img src={logo} alt="" width="235" height="50" className="h-[50px] w-auto" /></Link>
        <h1 className="text-center text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </main>
    </div>
    </>
  );
}

export const GoogleButton = ({ onClick, disabled }) => (
  <button type="button" className="btn-secondary w-full" onClick={onClick} disabled={disabled}>
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
    Continue with Google
  </button>
);
