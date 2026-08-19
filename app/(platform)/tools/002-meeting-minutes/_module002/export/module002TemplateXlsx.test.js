import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { module002CreateDraft, module002CreateInitialWorkspace } from "../domain/module002Factories";
import {
  module002BuildAttendanceContent,
  module002BuildAttendanceXlsx,
} from "./module002TemplateXlsx";

/** 读取项目内置签到簿模板，确保导出测试覆盖真实合并单元格。 */
async function module002ReadBuiltInAttendanceTemplate() {
  const module002Bytes = await readFile(
    path.join(process.cwd(), "public", "module002-templates", "module002-attendance-template.xlsx"),
  );
  return new File([module002Bytes], "module002-attendance-template.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("module002 attendance template export", () => {
  it("保留模板表格并填入参会单位、会议名称和逐行议题", async () => {
    const module002Config = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Config.templates[0],
      module002DocumentFormat: module002Config.documentFormat,
      module002People: module002Config.people,
    });
    module002Draft.topics = [
      { id: "topic-1", title: "学习重要文件", order: 0, firstTopicLocked: false, sources: [] },
      { id: "topic-2", title: "研究支部事项", order: 1, firstTopicLocked: false, sources: [] },
    ];
    const module002Blob = await module002BuildAttendanceXlsx({
      module002TemplateFile: await module002ReadBuiltInAttendanceTemplate(),
      module002Mapping: module002Config.exportTemplates.attendance.mapping,
      module002Content: module002BuildAttendanceContent(module002Draft, module002Config),
    });
    const module002ExcelModule = await import("exceljs");
    const module002Excel = module002ExcelModule.default ?? module002ExcelModule;
    const module002Workbook = new module002Excel.Workbook();
    await module002Workbook.xlsx.load(
      new Uint8Array(await module002Blob.arrayBuffer()),
    );
    const module002Sheet = module002Workbook.worksheets[0];
    expect(module002Sheet.getCell("C2").value).toBe("宁江直属库有限公司第三党支部");
    expect(module002Sheet.getCell("C3").value).toBe("党员大会");
    expect(module002Sheet.getCell("C4").value).toBe("1. 学习重要文件\n2. 研究支部事项");
    expect(module002Sheet.getCell("C4").font.size).toBe(16);
  });
});
