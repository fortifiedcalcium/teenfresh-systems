import React from "react";

/** The event's contact links (Facebook, X, Instagram, TikTok, Gmail ...). Only http(s) and mailto links are shown. */
export const contactLinkList = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((l) => l && l.label && /^(https?:\/\/|mailto:)/i.test(String(l.url || "")));

export default function ContactLinks({ links, className = "" }) {
  const list = contactLinkList(links);
  if (!list.length) return null;
  return (
    <ul className={`mt-1 flex flex-wrap gap-x-5 ${className}`} aria-label="Contact links">
      {list.map((l) => (
        <li key={l.label}><a href={l.url} {...(l.url.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })} className="inline-flex min-h-target items-center">{l.label}{!l.url.startsWith("mailto:") && <>{" "}<span className="sr-only">(opens in a new tab)</span></>}</a></li>
      ))}
    </ul>
  );
}
