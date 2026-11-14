import React, { useRef } from "react";

const wrapLines = (t) => t.split("\n").map((l) => (l.trim() ? l.replace(/^(\s*)(.*?)(\s*)$/, "$1**$2**$3") : l)).join("\n");
const unwrapLines = (t) => t.split("\n").map((l) => l.replace(/\*\*([^*]+)\*\*/g, "$1")).join("\n");
const allBold = (t) => t.split("\n").filter((l) => l.trim()).every((l) => /^\s*\*\*[^*]+\*\*\s*$/.test(l));

/** A textarea with a Bold button (and Ctrl/Cmd+B). Bold text is stored as **text**, which FormattedText shows as bold.
 *  `onChange` receives the new string. Extra props (id, aria-*) from <Field> go to the textarea. */
export default function BoldTextarea({ value, onChange, maxLength, rows = 4, ...rest }) {
  const ref = useRef(null);

  const toggleBold = () => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    let next;
    let from = s;
    let to;
    if (s === e) {                                                        // nothing selected: add a pair of markers and put the cursor between them
      next = value.slice(0, s) + "****" + value.slice(e);
      from = to = s + 2;
    } else if (value.slice(s - 2, s) === "**" && value.slice(e, e + 2) === "**") {   // the selection sits inside markers: remove them
      next = value.slice(0, s - 2) + sel + value.slice(e + 2);
      from = s - 2; to = e - 2;
    } else if (allBold(sel)) {                                            // the selection is already bold: remove the bold
      const t = unwrapLines(sel);
      next = value.slice(0, s) + t + value.slice(e);
      to = s + t.length;
    } else {
      const t = wrapLines(sel);
      next = value.slice(0, s) + t + value.slice(e);
      to = s + t.length;
    }
    if (maxLength && next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from, to); });
  };

  return (
    <div>
      <div role="toolbar" aria-label="Text formatting" className="mb-1 flex gap-1">
        <button type="button" className="btn-secondary min-w-0 px-3" onClick={toggleBold} aria-keyshortcuts="Control+B Meta+B" title="Bold (Ctrl+B or Cmd+B)"><b aria-hidden="true">B</b><span className="sr-only">Bold</span></button>
      </div>
      <textarea
        ref={ref} className="input" rows={rows} maxLength={maxLength} value={value} {...rest}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleBold(); } }}
      />
    </div>
  );
}
