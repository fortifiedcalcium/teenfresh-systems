import React, { useEffect, useRef, useState } from "react";
import { sanitize } from "./SafeHtml.jsx";
import { IconLink, IconList, IconParagraph } from "./NavIcons.jsx";

const exec = (cmd, arg) => document.execCommand?.(cmd, false, arg);
const BUTTONS = [
  ["Bold", () => exec("bold"), <b key="b" aria-hidden="true" className="font-serif text-base leading-none">B</b>],
  ["Italic", () => exec("italic"), <i key="i" aria-hidden="true" className="font-serif text-base leading-none">I</i>],
  ["Underline", () => exec("underline"), <u key="u" aria-hidden="true" className="font-serif text-base leading-none">U</u>],
  ["Bulleted list", () => exec("insertUnorderedList"), <IconList key="ul" />],
  ["Numbered list", () => exec("insertOrderedList"), <IconParagraph key="ol" />],
  ["Clear formatting", () => { exec("removeFormat"); exec("unlink"); }, <span key="c" aria-hidden="true" className="font-serif text-base leading-none">T<sub>x</sub></span>],
];

/** A built-in visual editor for the Terms: type, select text and press Bold / lists / Link. No HTML to write.
 *  What it produces is passed through the same whitelist sanitizer as the attendee page and the email. */
export default function TermsEditor({ id, value, onChange }) {
  const ref = useRef(null);
  const last = useRef(null);            // the last HTML this editor itself emitted
  const saved = useRef(null);           // the selection, kept while the link box has focus
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("https://");
  const urlRef = useRef(null);
  useEffect(() => { if (linkOpen) urlRef.current?.focus(); }, [linkOpen]);

  // load / reload when the value changes from outside (opening another event), not on every keystroke
  useEffect(() => {
    if (ref.current && value !== last.current) { ref.current.innerHTML = sanitize(value); last.current = value; }
  }, [value]);

  const emit = () => {
    const html = sanitize(ref.current.innerHTML);
    if (html !== ref.current.innerHTML) {            // something the whitelist refuses (e.g. a dropped image): remove it from the box too
      ref.current.innerHTML = html;
      const r = document.createRange(); r.selectNodeContents(ref.current); r.collapse(false);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    last.current = html;
    onChange(html);
  };
  const run = (fn) => { ref.current.focus(); fn(); emit(); };
  const openLink = () => {
    const sel = window.getSelection();
    saved.current = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setLinkOpen(true);
  };
  const applyLink = () => {
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    ref.current.focus();
    const sel = window.getSelection();
    if (saved.current) { sel.removeAllRanges(); sel.addRange(saved.current); }
    if (sel.isCollapsed) exec("insertHTML", `<a href="${href.replace(/"/g, "%22")}">${href.replace(/[<>&]/g, "")}</a>`);
    else exec("createLink", href);
    setLinkOpen(false); setUrl("https://"); emit();
  };

  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap gap-2">
        {BUTTONS.map(([label, fn, icon]) => (
          <button key={label} type="button" className="btn-secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => run(fn)}>{icon}{label}</button>
        ))}
        <button type="button" className="btn-secondary" aria-expanded={linkOpen} onMouseDown={(e) => e.preventDefault()} onClick={openLink}><IconLink />Link</button>
      </div>
      {linkOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-link bg-brand-ivory p-3">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-url`} className="label">Link address</label>
            <input id={`${id}-url`} className="input" type="url" value={url} ref={urlRef} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }} />
          </div>
          <button type="button" className="btn-primary" onClick={applyLink}>Add link</button>
          <button type="button" className="btn-secondary" onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}
      <div
        id={id} ref={ref} role="textbox" aria-multiline="true" aria-label="Terms and Conditions" aria-describedby={`${id}-help`} tabIndex={0}
        contentEditable suppressContentEditableWarning
        className="input safe-html min-h-48 overflow-auto bg-white text-sm"
        onFocus={() => exec("defaultParagraphSeparator", "p")}
        onInput={emit}
        onPaste={(e) => { e.preventDefault(); exec("insertText", e.clipboardData.getData("text/plain")); }}
      />
      <p id={`${id}-help`} className="text-xs text-ink-muted">Type here and format it like a normal document. Select text, then press a button above. Pasted text keeps no outside styling.</p>
    </div>
  );
}
