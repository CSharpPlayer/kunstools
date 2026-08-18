import { describe, expect, it } from "vitest";
import {
  module002CreateDraft,
  module002CreateInitialWorkspace,
} from "./module002Factories";

describe("module002 initial domain", () => {
  it("只为第三党支部预置党员大会模板、人员和默认会议角色", () => {
    const module002Workspace = module002CreateInitialWorkspace();

    expect(module002Workspace.branches.map((item) => item.name)).toEqual([
      "第一党支部",
      "第二党支部",
      "第三党支部",
    ]);
    expect(module002Workspace.templates).toHaveLength(1);
    expect(module002Workspace.templates[0].name).toBe("党员大会");
    expect(module002Workspace.templates[0].modules[0].styleOverride).toEqual({});
    expect(module002Workspace.documentFormat.mainTitle.align).toBe("center");
    expect(module002Workspace.documentFormat.secondTitle).toMatchObject({
      fontFamily: "黑体",
      fontSizePt: 16,
      bold: false,
      firstLineIndentChars: 2,
    });
    expect(module002Workspace.people.map((item) => item.name)).toEqual([
      "李万庄",
      "李风华",
      "牛井奎",
      "赵志国",
      "陈国辉",
      "王云松",
      "许艳杰",
      "李翔鲲",
    ]);
    expect(module002Workspace.people[2].values.branchRole).toBe(
      "支部宣传、青年、组织委员",
    );
    expect(module002Workspace.templates[0].defaults).toMatchObject({
      hostPersonId: module002Workspace.people[0].id,
      recorderPersonId: module002Workspace.people[7].id,
    });
  });

  it("草稿保存模板和文档格式快照", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: module002Workspace.people,
    });

    expect(module002Draft.templateSnapshot.name).toBe("党员大会");
    expect(module002Draft.documentFormatSnapshot.marginTopCm).toBe(3.7);
    expect(module002Draft.prompt).toContain("中储粮宁江直属库第三党支部");
    expect(module002Draft.prompt).toContain('"serialNumber"');
    expect(module002Draft.meetingInfo.hostPersonId).toBe(module002Workspace.people[0].id);
    expect(module002Draft.meetingInfo.recorderPersonId).toBe(module002Workspace.people[7].id);
  });
});
