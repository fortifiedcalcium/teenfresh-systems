import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildMultiWorkbook, buildWorkbook, toXlsxBuffer } from "../lib/excel.js";

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

  it("writes several sheets in one workbook, each with its own styled header", async () => {
    const wb = await buildMultiWorkbook([{ name: "Orders", head: ["No", "Total"], rows: [["TF-1", 100]] }, { name: "Items", head: ["No", "Qty"], rows: [["TF-1", 2], ["TF-1", 1]] }], { colors: { fill: "FF17303F", text: "FFFCF7E3" } });
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await wb.xlsx.writeBuffer());
    expect(back.worksheets.map((w) => w.name)).toEqual(["Orders", "Items"]);
    expect(back.getWorksheet("Items").rowCount).toBe(3);
    expect(back.getWorksheet("Orders").getCell("B2").value).toBe(100);
    for (const w of back.worksheets) { expect(w.views[0]).toMatchObject({ state: "frozen", ySplit: 1 }); expect(w.getCell("A1").font.bold).toBe(true); }
  });
});
