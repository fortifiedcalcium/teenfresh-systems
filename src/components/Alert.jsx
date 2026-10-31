import React from "react";

const ROLE = { bad: "alert", warn: "status", ok: "status", info: "status" };

/** tone: bad | warn | ok | info. Colour + icon + text; announced to screen readers. */
export default function Alert({ tone = "info", children, className = "", live = true }) {
  return <div role={live ? ROLE[tone] : undefined} className={`alert alert-${tone} ${className}`}><div className="min-w-0 flex-1">{children}</div></div>;
}
