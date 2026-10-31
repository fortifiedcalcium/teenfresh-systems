// CSV export. Cells starting with = + - @ are prefixed so Excel/Sheets cannot run them as formulas.
const cell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(head, rows) {
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename, head, rows) {
  const blob = new Blob(["﻿" + toCsv(head, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
