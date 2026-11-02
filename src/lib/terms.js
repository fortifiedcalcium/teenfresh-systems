// Terms and Conditions are typed as plain text by the admin and turned into HTML once, when the event is saved.
// The stored value (events.terms_html) is still sanitized HTML, so the attendee page and the emails need no change.
//
// Plain-text rules:
//   blank line            -> new paragraph          single line break -> <br>
//   "- item" / "* item"   -> bullet list            "1. item"         -> numbered list
//   **bold**  *italic*  __underline__               [text](https://link)  or a bare https:// link

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SAFE_URL = /^(?:https?:\/\/|mailto:)[^\s<>"]+$/i;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

function inline(text) {
  const links = [];
  const keep = (html) => `\uE000${links.push(html) - 1}\uE000`;
  let s = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) => (SAFE_URL.test(url) ? keep(`<a href="${esc(url)}">${esc(label)}</a>`) : m));
  s = s.replace(/(^|[\s(])((?:https?:\/\/|mailto:)[^\s<>"]+?)([.,;:!?)]*)(?=\s|$)/gi, (m, pre, url, tail) => `${pre}${keep(`<a href="${esc(url)}">${esc(url)}</a>`)}${tail}`);
  s = esc(s)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, "<u>$1</u>")
    .replace(/(^|[^*\w])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\w])/g, "$1<em>$2</em>");
  return s.replace(/\uE000(\d+)\uE000/g, (m, i) => links[Number(i)]);
}

/** Plain text -> HTML (only the tags the sanitizer allows). Empty text gives "". */
export function textToHtml(text) {
  const blocks = String(text ?? "").replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.replace(/^\n+|\s+$/g, "")).filter((b) => b.trim());
  const out = [];
  for (const block of blocks) {
    let list = null, para = [];
    const flushPara = () => { if (para.length) out.push(`<p>${para.join("<br>\n")}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag}>\n${list.items.map((i) => `<li>${i}</li>`).join("\n")}\n</${list.tag}>`); list = null; };
    for (const line of block.split("\n")) {
      const b = BULLET.exec(line), n = NUMBER.exec(line), tag = b ? "ul" : n ? "ol" : null;
      if (tag) {
        flushPara();
        if (list && list.tag !== tag) flushList();
        list = list || { tag, items: [] };
        list.items.push(inline((b || n)[1].trim()));
      } else if (line.trim()) {
        flushList();
        para.push(inline(line.trim()));
      }
    }
    flushList(); flushPara();
  }
  return out.join("\n");
}

/** Stored HTML -> the plain text an admin edits (so events saved before this change open as readable text). */
export function htmlToText(html) {
  const src = String(html ?? "").trim();
  if (!src) return "";
  if (!/<[a-z][\s\S]*>/i.test(src)) return src;                                  // already plain text
  const doc = new DOMParser().parseFromString(src, "text/html");
  const inl = (node) => [...node.childNodes].map((c) => {
    if (c.nodeType === 3) return c.textContent.replace(/\s+/g, " ");
    if (c.nodeType !== 1) return "";
    const tag = c.tagName.toLowerCase(), t = inl(c);
    if (tag === "br") return "\n";
    if (tag === "strong" || tag === "b") return `**${t}**`;
    if (tag === "em" || tag === "i") return `*${t}*`;
    if (tag === "u") return `__${t}__`;
    if (tag === "a") { const href = c.getAttribute("href") || ""; return SAFE_URL.test(href) ? `[${t}](${href})` : t; }
    return t;
  }).join("");
  const blocks = [];
  const walk = (parent) => {
    for (const c of parent.childNodes) {
      if (c.nodeType === 3) { if (c.textContent.trim()) blocks.push(c.textContent.trim()); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        blocks.push([...c.children].filter((li) => li.tagName === "LI").map((li, i) => `${tag === "ol" ? `${i + 1}.` : "-"} ${inl(li).trim()}`).join("\n"));
      } else if (tag === "p" || tag === "div") blocks.push(inl(c).trim());
      else if (["script", "style"].includes(tag)) continue;
      else blocks.push(inl(c).trim());
    }
  };
  walk(doc.body);
  return blocks.filter(Boolean).join("\n\n");
}
