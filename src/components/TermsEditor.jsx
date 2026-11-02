import React, { useMemo, useRef } from "react";
import SafeHtml from "./SafeHtml.jsx";
import { IconLink, IconList, IconParagraph } from "./NavIcons.jsx";
import { wrapSelection } from "../lib/formatText.js";
import { textToHtml } from "../lib/terms.js";

const wrap = (open, close, placeholder) => (v, s, e) => wrapSelection(v, s, e, open, close, placeholder);
/** Puts a prefix in front of every selected line ("- " or "1. "), or removes it again when they all have it. */
const prefixLines = (numbered) => (v, s, e) => {
  const from = v.lastIndexOf("\n", s - 1) + 1, nl = v.indexOf("\n", e), to = nl === -1 ? v.length : nl;
  const lines = v.slice(from, to).split("\n");
  const has = (l) => (numbered ? /^\d+[.)]\s/ : /^[-*]\s/).test(l);
  const next = lines.every(has) ? lines.map((l) => l.replace(numbered ? /^\d+[.)]\s/ : /^[-*]\s/, "")) : lines.map((l, i) => (has(l) ? l : `${numbered ? `${i + 1}. ` : "- "}${l}`));
  const text = next.join("\n");
  return { value: v.slice(0, from) + text + v.slice(to), start: from, end: from + text.length };
};

const BUTTONS = [
  ["Bold", wrap("**", "**", "bold text"), <b key="b" aria-hidden="true" className="font-serif text-base leading-none">B</b>],
  ["Italic", wrap("*", "*", "italic text"), <i key="i" aria-hidden="true" className="font-serif text-base leading-none">I</i>],
  ["Bulleted list", prefixLines(false), <IconList key="u" />],
  ["Numbered list", prefixLines(true), <IconParagraph key="p" />],
  ["Link", (v, s, e) => { const t = v.slice(s, e) || "link text"; return { value: `${v.slice(0, s)}[${t}](https://)${v.slice(e)}`, start: s + t.length + 3, end: s + t.length + 11 }; }, <IconLink key="k" />],
];

/** A plain-text editor for the Terms: no HTML to type. Blank line = new paragraph, "- " = bullet, "1. " = number,
 *  **bold**, *italic*, [text](https://link). The preview shows exactly what attendees will see; the text is turned into
 *  sanitized HTML once, when the event is saved. */
export default function TermsEditor({ id, value, onChange }) {
  const ref = useRef(null);
  const html = useMemo(() => textToHtml(value), [value]);
  const apply = (make) => {
    const el = ref.current;
    const r = make(value, el.selectionStart, el.selectionEnd);
    onChange(r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap gap-2">
        {BUTTONS.map(([label, make, icon]) => <button key={label} type="button" className="btn-secondary" onClick={() => apply(make)}>{icon}{label}</button>)}
      </div>
      <textarea id={id} ref={ref} rows={12} className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-help`} spellCheck />
      <p id={`${id}-help`} className="text-xs text-ink-muted">Just type. Leave a blank line between paragraphs. Start a line with <code>- </code> for bullets or <code>1. </code> for numbers. Use <code>**bold**</code>, <code>*italic*</code> and <code>[text](https://link)</code>.</p>
      <div>
        <p className="label">Preview (what attendees see)</p>
        <div className="rounded-lg border border-link bg-brand-ivory p-3 text-sm"><SafeHtml html={html} /></div>
      </div>
    </div>
  );
}
