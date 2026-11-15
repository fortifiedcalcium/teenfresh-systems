/** Wraps the selected text in an HTML tag, or removes that tag again when the selection is already wrapped
 *  (so pressing Bold twice un-bolds). Pure function: returns the new value and where the selection should be. */
export function wrapSelection(value, start, end, open, close, placeholder = "text") {
  const before = value.slice(0, start), sel = value.slice(start, end), after = value.slice(end);
  // selection includes the tags: <strong>abc</strong>
  if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
    const inner = sel.slice(open.length, sel.length - close.length);
    return { value: before + inner + after, start, end: start + inner.length };
  }
  // the tags sit just outside the selection: <strong>[abc]</strong>
  if (before.endsWith(open) && after.startsWith(close)) {
    const s = start - open.length;
    return { value: before.slice(0, s) + sel + after.slice(close.length), start: s, end: s + sel.length };
  }
  const text = sel || placeholder;
  return { value: before + open + text + close + after, start: start + open.length, end: start + open.length + text.length };
}

export const FORMATS = {
  bold: { label: "Bold", open: "<strong>", close: "</strong>", key: "b", placeholder: "bold text" },
  italic: { label: "Italic", open: "<em>", close: "</em>", key: "i", placeholder: "italic text" },
  underline: { label: "Underline", open: "<u>", close: "</u>", key: "u", placeholder: "underlined text" },
  link: { label: "Link", open: '<a href="https://">', close: "</a>", placeholder: "link text" },
  paragraph: { label: "Paragraph", open: "<p>", close: "</p>", placeholder: "Paragraph" },
};
