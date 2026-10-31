import React, { useMemo } from "react";
import DOMPurify from "dompurify";

// Admin-edited HTML (the Terms) is always passed through a whitelist sanitizer before it is rendered.
// The email functions use an equivalent whitelist (supabase/functions/_shared/merge.ts: sanitizeHtml).
const CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "span"],
  ALLOWED_ATTR: ["href"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
};

export const sanitize = (html) => DOMPurify.sanitize(String(html ?? ""), CONFIG);

export default function SafeHtml({ html, className = "" }) {
  const clean = useMemo(() => sanitize(html), [html]);
  // The HTML is sanitized above, so injecting it is safe.
  return <div className={`safe-html ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
