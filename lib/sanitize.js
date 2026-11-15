import DOMPurify from "dompurify";

// Admin-edited HTML (the Terms) is always passed through a whitelist sanitizer before it is rendered.
// The email functions use an equivalent whitelist (supabase/functions/_shared/merge.ts: sanitizeHtml).
const CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "span"],
  ALLOWED_ATTR: ["href"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
};

export const sanitize = (html) => DOMPurify.sanitize(String(html ?? ""), CONFIG);
