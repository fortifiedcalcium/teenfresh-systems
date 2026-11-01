import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, toXlsxBuffer } from "../src/lib/excel.js";

const read = async (head, rows, opts) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await toXlsxBuffer(head, rows, opts));
  return wb.worksheets[0];
};

describe("Excel export", () => {
  const head = ["Ticket", "Name", "Total", "Registered"];
  const rows = [["IVEMON-000001", "Juan Dela Cruz", 200, "Nov 1, 2026"], ["", "=HYPERLINK(\"http://evil\")", "", null]];

  it("writes a real .xlsx with the header, the rows and typed cells", async () => {
    const ws = await read(head, rows, { sheet: "Attendees" });
    expect(ws.name).toBe("Attendees");
    expect(ws.getRow(1).values.slice(1)).toEqual(head);
    expect(ws.getCell("A2").value).toBe("IVEMON-000001");
    expect(ws.getCell("C2").value).toBe(200);                 // numbers stay numbers
    expect(typeof ws.getCell("C2").value).toBe("number");
    expect(ws.rowCount).toBe(3);
  });

  it("never turns a cell into a formula", async () => {
    const ws = await read(head, rows);
    const c = ws.getCell("B3");
    expect(c.type).toBe(ExcelJS.ValueType.String);
    expect(c.value).toBe('=HYPERLINK("http://evil")');
    expect(c.formula).toBeUndefined();
  });

  it("freezes and filters the header row, bolds it and sizes the columns", async () => {
    const ws = await read(head, rows, { colors: { fill: "FF17303F", text: "FFFCF7E3" } });
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    const h = ws.getCell("A1");
    expect(h.font.bold).toBe(true);
    expect(h.fill.fgColor.argb).toBe("FF17303F");
    expect(ws.getColumn(2).width).toBeGreaterThan(ws.getColumn(3).width);
    expect(ws.getColumn(1).width).toBeLessThanOrEqual(50);
  });

  it("cleans the sheet name (Excel forbids \\ / ? * [ ] : and more than 31 characters)", async () => {
    const wb = await buildWorkbook(["A"], [["x"]], { sheet: "attendees/IVEMON: ODD PLATINUM [2026] extra long name here" });
    expect(wb.worksheets[0].name).not.toMatch(/[\\/?*[\]:]/);
    expect(wb.worksheets[0].name.length).toBeLessThanOrEqual(31);
  });

  it("handles an empty report", async () => {
    const ws = await read(head, []);
    expect(ws.rowCount).toBe(1);
  });
});
