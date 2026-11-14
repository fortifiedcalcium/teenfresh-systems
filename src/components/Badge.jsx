import React from "react";

/** tone: ok | warn | bad | info | neutral. Every badge shows an icon, text and colour (1.4.1).
 *  The icon is a symbol drawn by the CSS for the tone; pass `icon` (an element) to use a picture instead. */
export default function Badge({ tone = "neutral", children, title, icon }) {
  return <span className={`badge badge-${tone}${icon ? " badge-has-icon" : ""}`} title={title}>{icon}{children}</span>;
}
