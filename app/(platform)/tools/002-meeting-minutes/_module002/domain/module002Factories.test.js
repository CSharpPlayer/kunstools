import { describe, expect, it } from "vitest";
import {
  module002CreateDraft,
  module002CreateInitialWorkspace,
} from "./module002Factories";

describe("module002 initial domain", () => {
  it("为三党支部预置党员大会、支委会模板，并为第三党支部配置专用角色", () => {
    const module002Workspace = module002CreateInitialWorkspace();

    expect(module002Workspace.branches.map((item) => item.name)).toEqual([
      "第一党支部",
      "第二党支部",
      "第三党支部",
    ]);
    expect(module002Workspace.templates).toHaveLength(6);
    expect(module002Workspace.templates[0].name).toBe("党员大会");
    expect(module002Workspace.templates[1]).toMatchObject({
      name: "支委会",
      meetingType: "committeeMeeting",
    });
    expect(
      module002Workspace.templates.filter(
        (module002Template) =>
          module002Template.branchId === module002Workspace.branches[2].id,
      ),
    ).toHaveLength(2);
    expect(module002Workspace.templates[0].modules[0].styleOverride).toEqual({});
    expect(module002Workspace.documentFormat.mainTitle.align).toBe("center");
    expect(module002Workspace.documentFormat.secondTitle).toMatchObject({
      fontFamily: "黑体",
      fontSizePt: 16,
      bold: false,
      firstLineIndentChars: 2,
    });
    expect(module002Workspace.documentFormat.thirdTitle.firstLineIndentChars).toBe(2);
    expect(module002Workspace.personFields.map((item) => item.label)).toEqual([
      "序号",
      "姓名",
      "支部岗位",
      "业务岗位",
      "发言字数",
    ]);
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
    expect(module002Workspace.people[0].values.speechLength).toBe("120");
    expect(module002Workspace.people.slice(1).every(
      (module002Person) => module002Person.values.speechLength === "60",
    )).toBe(true);
    expect(module002Workspace.templates[0].defaults).toMatchObject({
      hostPersonId: module002Workspace.people[0].id,
      recorderPersonId: module002Workspace.people[7].id,
    });
    expect(module002Workspace.templates[1].defaultPrompt).toContain(
      '"secretaryImplementation"',
    );
    expect(module002Workspace.templates[1].defaultPrompt).toContain("发言字数");
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

  it("支委会新建草稿默认只选择书记和委员", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002CommitteeTemplate = module002Workspace.templates.find(
      (module002Template) => module002Template.name === "支委会",
    );
    const module002Draft = module002CreateDraft({
      module002Template: module002CommitteeTemplate,
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: module002Workspace.people,
    });

    expect(module002Draft.meetingInfo.attendeePersonIds).toEqual(
      module002Workspace.people.slice(0, 3).map((module002Person) => module002Person.id),
    );
    expect(module002Draft.speakerPersonIds).toEqual(
      module002Draft.meetingInfo.attendeePersonIds,
    );
    expect(module002Draft.meetingInfo.recorderPersonId).toBeNull();
  });
});
