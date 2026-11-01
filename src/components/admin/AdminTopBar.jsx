import React from "react";
import { Link, useLocation } from "react-router-dom";
import { IconArrowLeft } from "../NavIcons.jsx";
import { titleFor } from "./adminNav.js";

/** Slim sticky header below 1024px (the sidebar carries the context on desktop). 56px, safe-area aware.
 *  The title is shown here but is aria-hidden: each page keeps its own <h1> (screen-reader only on small screens), so
 *  there is exactly one h1 and route changes still move focus to it. `#admin-topbar-actions` receives page actions. */
export default function AdminTopBar() {
  const { pathname } = useLocation();
  const { title, back } = titleFor(pathname);
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b-2 border-ink bg-brand-cream px-3 lg:hidden" style={{ minHeight: "var(--topbar-h)", paddingTop: "var(--safe-top)" }}>
      {back && <Link to={back} className="btn-secondary min-w-target px-2" aria-label="Back to Profile"><IconArrowLeft /></Link>}
      <p className="min-w-0 flex-1 truncate text-lg font-extrabold" aria-hidden="true">{title}</p>
      <div id="admin-topbar-actions" className="flex items-center gap-2" />
    </header>
  );
}
