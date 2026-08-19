import { describe, expect, it } from "vitest";
import { module002CreateDraft, module002CreateInitialWorkspace } from "../domain/module002Factories";
import { module002CreateExportFileNames } from "./module002ExportBundle";

describe("module002 export bundle", () => {
  it("按日期-会议名称规则生成会议记录、通知和签到簿文件名", () => {
    const module002Config = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Config.templates[0],
      module002DocumentFormat: module002Config.documentFormat,
      module002People: module002Config.people,
    });
    module002Draft.meetingInfo.date = "2026-08-18";
    module002Draft.meetingInfo.meetingName = "党员大会";
    expect(module002CreateExportFileNames(module002Draft)).toEqual({
      record: "2026-8-18-党员大会.docx",
      notice: "2026-8-18-党员大会-通知.docx",
      attendance: "2026-8-18-党员大会-签到簿.xlsx",
    });
  });
});
