import React from "react";
import { Link } from "react-router-dom";
import { IconScanLine } from "../NavIcons.jsx";

/** The centre scan button. Raised (protruding about half above the bar) everywhere except the Scanner page, where it is
 *  docked inside the bar; the nav's data-docked attribute drives the 180 ms move (CSS, off with reduced motion).
 *  Round hit area only: it is a circle, so it never covers the neighbouring tabs. */
export default function ScanFab({ to, label, active, onActiveClick }) {
  return (
    <li className="scan-fab-slot">
      <Link
        to={to} className="scan-fab" aria-label={label} title={label} aria-current={active ? "page" : undefined}
        onClick={(e) => { if (active && onActiveClick) { e.preventDefault(); onActiveClick(); } }}
      >
        <IconScanLine />
      </Link>
    </li>
  );
}
