import React from "react";
import { Link } from "react-router-dom";

/** One tab: a real link (so long-press, open in new tab and keyboard behave), icon above label.
 *  Active state comes from the router's location (aria-current="page"), never from local state. */
export default function BottomNavItem({ to, label, icon: Icon, active, badge = 0, badgeLabel, onActiveClick }) {
  return (
    <li>
      <Link
        to={to} className="bottom-nav-item h-full w-full" aria-current={active ? "page" : undefined}
        onClick={(e) => { if (active && onActiveClick) { e.preventDefault(); onActiveClick(); } }}
      >
        <Icon />
        <span className="bottom-nav-item__label">{label}</span>
        {badge > 0 && (
          <>
            <span className="nav-badge" aria-hidden="true">{badge > 99 ? "99+" : badge}</span>
            <span className="sr-only">{badgeLabel || `${badge} pending`}</span>
          </>
        )}
      </Link>
    </li>
  );
}
