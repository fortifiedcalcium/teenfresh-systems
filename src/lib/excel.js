// Excel (.xlsx) export for every report. exceljs is loaded on demand, so it is only downloaded when someone exports.
// Cell values are written as typed values (text stays text, numbers stay numbers), never as formulas, so a name such as
// "=HYPERLINK(...)" cannot run in Excel.

const argb = (cssVar) => {
  if (typeof document === "undefined") return null;
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim().replace("#", "");
  return /^[0-9a-f]{6}$/i.test(v) ? "FF" + v.toUpperCase() : null;   // the Teenfresh tokens, read from tokens.css
};

const clean = (v) => (v == null ? "" : typeof v === "number" || typeof v === "boolean" || v instanceof Date ? v : String(v));

/** Builds the workbook: one sheet, a styled frozen header row with filters, and column widths that fit the content. */
export async function buildWorkbook(head, rows, { sheet = "Report", colors = {} } = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Teenfresh Events";
  wb.created = new Date();
  const ws = wb.addWorksheet(String(sheet).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Report", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(head);
  for (const r of rows) ws.addRow(r.map(clean));

  const fill = colors.fill ?? argb("--ink"), text = colors.text ?? argb("--brand-ivory");
  const header = ws.getRow(1);
  header.font = { bold: true, ...(text ? { color: { argb: text } } : {}) };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;
  if (fill) header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(head.length, 1) } };
  head.forEach((h, i) => {
    const longest = rows.reduce((m, r) => Math.max(m, String(r[i] ?? "").length), String(h).length);
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 50);
  });
  return wb;
}

export async function toXlsxBuffer(head, rows, opts) {
  return (await buildWorkbook(head, rows, opts)).xlsx.writeBuffer();
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Downloads the report. `filename` should end in .xlsx. */
export async function downloadExcel(filename, head, rows, opts = {}) {
  const buffer = await toXlsxBuffer(head, rows, { sheet: opts.sheet ?? filename.replace(/\.xlsx$/i, ""), ...opts });
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_TYPE }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** What the pages call: downloads the report, and tells the person if it could not be made. */
export const exportReport = (toast, filename, head, rows, opts) =>
  downloadExcel(filename, head, rows, opts).catch(() => toast("Could not create the Excel file. Please try again.", "error"));
