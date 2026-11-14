import React from "react";

/** Shows text an admin wrote with **bold** markers. Only bold is recognised, and everything else is plain text
 *  (React escapes it), so admin text can never add HTML. Line breaks are kept by the caller's CSS (white-space: pre-line). */
export default function FormattedText({ text }) {
  const src = String(text ?? "");
  const out = [];
  let last = 0;
  let n = 0;
  for (const m of src.matchAll(/\*\*(?!\s)([^*\n]*[^*\s])\*\*/g)) {
    if (m.index > last) out.push(src.slice(last, m.index));
    out.push(<strong key={n++}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return <>{out}</>;
}
