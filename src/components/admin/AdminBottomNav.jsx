import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import BottomNavItem from "./BottomNavItem.jsx";
import ScanFab from "./ScanFab.jsx";
import { matchers, TABS } from "./adminNav.js";

/** Scroll to the top and put focus on the page heading, like tapping the active tab in a native app. */
export function scrollTopAndFocus() {
  window.scrollTo({ top: 0, behavior: "auto" });
  const h = document.querySelector("#main-content h1");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

/** Five slots: Home, Search, [Scan], History, Profile. Rendered below 1024px (lg:hidden is display:none, so the hidden bar
 *  is out of the accessibility tree and the tab order). hidden: keyboard open. */
export default function AdminBottomNav({ pending = 0, hidden = false }) {
  const { pathname } = useLocation();
  const docked = matchers.scan(pathname);
  // announce a changed pending count politely, but not the first value
  const first = useRef(true);
  const [live, setLive] = useState("");
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setLive(`${pending} payment${pending === 1 ? "" : "s"} pending verification`);
  }, [pending]);

  return (
    <nav aria-label="Admin" className="admin-bottom-nav on-ink lg:hidden" data-docked={docked} data-hidden={hidden}>
      <div className="admin-bottom-nav__shadow" aria-hidden="true"><div className="admin-bottom-nav__bg" /></div>
      <ul className="admin-bottom-nav__list">
        {TABS.map((t) => t.fab
          ? <ScanFab key={t.key} to={t.to} label={t.label} active={matchers[t.key](pathname)} onActiveClick={scrollTopAndFocus} />
          : <BottomNavItem key={t.key} to={t.to} label={t.label} icon={t.icon} active={matchers[t.key](pathname)} onActiveClick={scrollTopAndFocus}
              badge={t.key === "profile" ? pending : 0} badgeLabel={`${pending} payment${pending === 1 ? "" : "s"} pending verification`} />)}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">{live}</span>
    </nav>
  );
}
