import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../../hooks/useBreakpoint.js";
import { MEDIA } from "../../lib/breakpoints.js";

/** A page action (e.g. Export CSV). On desktop it is the normal labelled button in the page. Below 1024px it moves into the
 *  top bar as an icon button with a visible short label and a tooltip. */
export default function TopBarAction({ label, icon: Icon, onClick, disabled, className = "btn-secondary", short }) {
  const small = useMediaQuery(MEDIA.bottomNav);
  const [slot, setSlot] = useState(null);
  useEffect(() => { setSlot(small ? document.getElementById("admin-topbar-actions") : null); }, [small]);
  const btn = <button type="button" className={className} onClick={onClick} disabled={disabled}><Icon />{label}</button>;
  if (!small || !slot) return btn;
  return createPortal(
    <button type="button" className="btn-secondary min-w-target flex-col gap-0 px-2 py-1 text-xs leading-tight" onClick={onClick} disabled={disabled} title={label}>
      <Icon /><span>{short || label}</span>
    </button>, slot);
}
