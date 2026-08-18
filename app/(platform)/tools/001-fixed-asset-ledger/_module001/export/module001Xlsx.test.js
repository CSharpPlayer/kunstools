import { describe, expect, it } from "vitest";
import {
  module001AddCustomField,
  module001CompleteInitialization,
} from "../domain/module001ProjectCommands";
import { module001CreateReadyTestProject } from "../test/module001Fixtures";
import { module001BuildLedgerXlsx } from "./module001Xlsx";

describe("module001 XLSX 导出", () => {
  it("保留文本编号、真实日期并阻止公式解释", async () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001Rows[0].name = "=HYPERLINK(\"x\")";
    module001Rows[1].name = module001Rows[0].name;
    module001CompleteInitialization(module001Project, module001Rows);
    const module001DateField = module001AddCustomField(module001Project, {
      name: "购置日期",
      type: "date",
      required: true,
      defaultValue: "2026-08-14",
      options: [],
    });
    const module001Buffer = await module001BuildLedgerXlsx(
      module001Project,
      module001Project.assets,
    );
    const module001ExcelModule = await import("exceljs");
    const Module001Excel =
      module001ExcelModule.default ?? module001ExcelModule;
    const module001Workbook = new Module001Excel.Workbook();
    await module001Workbook.xlsx.load(module001Buffer);
    const module001Sheet = module001Workbook.getWorksheet("固定资产台账");
    const module001CodeColumn = module001Project.table.columnOrder.indexOf("code") + 1;
    const module001NameColumn = module001Project.table.columnOrder.indexOf("name") + 1;
    const module001DateColumn =
      module001Project.table.columnOrder.indexOf(module001DateField.fieldId) + 1;

    expect(module001Sheet.getRow(2).getCell(module001CodeColumn).value).toBe("001");
    expect(module001Sheet.getRow(2).getCell(module001CodeColumn).numFmt).toBe("@");
    expect(module001Sheet.getRow(2).getCell(module001NameColumn).value).toBe(
      "'=HYPERLINK(\"x\")",
    );
    expect(
      module001Sheet.getRow(2).getCell(module001DateColumn).value,
    ).toBeInstanceOf(Date);
  });
});
