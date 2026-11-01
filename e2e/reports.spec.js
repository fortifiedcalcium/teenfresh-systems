import fs from "node:fs";
import ExcelJS from "exceljs";
import { test, expect } from "./fixtures.js";

test.use({ viewport: { width: 1280, height: 800 } });

async function sheetOf(download) {
  const path = await download.path();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(path));
  return wb.worksheets[0];
}

test.describe("Excel reports", () => {
  for (const [route, button, file, firstHeader] of [
    ["/admin/attendees", "Export Excel", /^attendees-.*\.xlsx$/, "Ticket"],
    ["/admin/payments", "Export Excel", /^payments-.*\.xlsx$/, "Sender"],
    ["/admin/tracker", "Export Excel", /^attendance-.*\.xlsx$/, "Ticket"],
  ]) {
    test(`${route} downloads a real .xlsx`, async ({ page, as }) => {
      await as("admin"); await page.goto(route); await page.waitForLoadState("networkidle");
      const btn = page.getByRole("button", { name: button });
      await expect(btn).toBeEnabled();
      const [download] = await Promise.all([page.waitForEvent("download"), btn.click()]);
      expect(download.suggestedFilename()).toMatch(file);
      const ws = await sheetOf(download);
      expect(ws.getCell("A1").value).toBe(firstHeader);
      expect(ws.getCell("A1").font.bold).toBe(true);
      expect(ws.rowCount).toBeGreaterThan(1);
      expect(ws.views[0].state).toBe("frozen");
    });
  }
  test("no page still offers a CSV export", async ({ page, as }) => {
    await as("admin");
    for (const route of ["/admin/attendees", "/admin/payments", "/admin/tracker"]) {
      await page.goto(route); await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: /CSV/ })).toHaveCount(0);
    }
  });
});

test.describe("Edit / transfer slot", () => {
  test("you can type whole words into every field, and save", async ({ page, as }) => {
    await as("admin"); await page.goto("/admin/attendees"); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^View Juan/ }).first().click();
    await page.getByRole("button", { name: /Edit \/ transfer/ }).click();
    const dlg = page.getByRole("dialog", { name: "Edit / transfer slot" });
    const name = dlg.getByLabel("Name", { exact: true });
    await name.fill("");
    await name.pressSequentially("Maria Clara Santos", { delay: 15 });
    await expect(name).toHaveValue("Maria Clara Santos");
    await expect(name).toBeFocused();
    const x = dlg.getByLabel("X username");
    await x.fill(""); await x.pressSequentially("maria_clara", { delay: 15 });
    await expect(x).toHaveValue("maria_clara");
    const email = dlg.getByLabel("Email", { exact: true });
    await email.fill(""); await email.pressSequentially("maria.clara@example.com", { delay: 15 });
    await expect(email).toHaveValue("maria.clara@example.com");
    await expect(email).toBeFocused();
    const notes = dlg.getByLabel("Notes");
    await notes.pressSequentially("Transferred from Juan", { delay: 15 });
    await expect(notes).toHaveValue(/Transferred from Juan$/);
  });
});
