import React from "react";

/** tone: ok | warn | bad | info | neutral. Every badge shows an icon, text and colour (1.4.1). */
export default function Badge({ tone = "neutral", children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}
