/** The event's contact links (Facebook, X, Instagram, TikTok, Gmail ...). Only http(s) and mailto links are shown. */
export const contactLinkList = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((l) => l && l.label && /^(https?:\/\/|mailto:)/i.test(String(l.url || "")));
