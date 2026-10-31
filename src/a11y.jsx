import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/* ---------- live regions (4.1.3): announce without moving focus ---------- */
const AnnounceContext = createContext(() => {});
export const useAnnounce = () => useContext(AnnounceContext);

export function LiveRegionProvider({ children }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const announce = useCallback((message, level = "polite") => {
    const set = level === "assertive" ? setAssertive : setPolite;
    set(""); // clear first so repeating the same text is announced again
    setTimeout(() => set(message), 50);
  }, []);
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{polite}</div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{assertive}</div>
    </AnnounceContext.Provider>
  );
}

/** Visible-or-hidden status text that screen readers announce when it changes. */
export const LiveRegion = ({ children, level = "polite", className = "sr-only" }) => (
  <div className={className} role={level === "assertive" ? "alert" : "status"} aria-live={level} aria-atomic="true">{children}</div>
);

/* ---------- document titles (2.4.2) ---------- */
const TITLES = [
  [/^\/$/, "Events"], [/^\/events\/[^/]+\/register$/, "Register for an event"], [/^\/my-registrations$/, "My registrations"],
  [/^\/my-ticket\/[^/]+$/, "My ticket"], [/^\/login$/, "Sign in"], [/^\/register$/, "Create an account"],
  [/^\/forgot-password$/, "Forgot password"], [/^\/reset-password$/, "Reset password"], [/^\/auth\/callback$/, "Signing in"],
  [/^\/admin$/, "Admin dashboard"], [/^\/admin\/events$/, "Admin: events"], [/^\/admin\/payments$/, "Admin: payments"], [/^\/admin\/attendees$/, "Admin: attendees"],
  [/^\/admin\/scanner$/, "Admin: QR scanner"], [/^\/admin\/tracker$/, "Admin: attendance"], [/^\/admin\/emails$/, "Admin: email"],
  [/^\/admin\/users$/, "Admin: users"],
];
export const titleFor = (pathname) => (TITLES.find(([re]) => re.test(pathname)) || [null, "Page not found"])[1];

/** On every route change: set a unique <title>, move focus to the page's h1 (or <main>) and announce the page.
 *  Skipped on first load so the browser keeps its normal behaviour. */
export function RouteA11y() {
  const { pathname } = useLocation();
  const announce = useAnnounce();
  const prev = useRef(null); // last pathname handled; null until the first load

  useEffect(() => {
    const title = titleFor(pathname);
    document.title = `${title} · Teenfresh Events`;
    // Skip the first load so the browser keeps its normal behaviour (also under StrictMode, which runs effects twice)
    if (prev.current === null || prev.current === pathname) { prev.current = pathname; return; }
    prev.current = pathname;
    let tries = 0;
    // pages load their data asynchronously, so wait briefly for the h1 to exist
    const timer = setInterval(() => {
      const target = document.querySelector("main h1") || (tries > 8 ? document.querySelector("main") : null);
      tries++;
      if (target || tries > 10) {
        clearInterval(timer);
        if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: false }); }
        announce(title);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, announce]);
  return null;
}

/** First tab stop. Focus is moved explicitly (not left to the browser's fragment handling) so it works in every browser and in the SPA router. */
export const SkipLink = () => (
  <a href="#main-content" className="skip-link" onClick={(e) => { e.preventDefault(); const m = document.getElementById("main-content"); m?.focus(); m?.scrollIntoView(); }}>Skip to main content</a>
);
