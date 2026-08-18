import { describe, expect, it } from "vitest";
import { module002CreateDraft, module002CreateInitialWorkspace } from "./module002Factories";
import { module002ParseDraft, module002ParseWorkspaceConfig } from "./module002Migrations";
import { module002PlaceholderPrompt } from "./module002Schemas";

describe("module002 migrations", () => {
  it("清除首版空样式误写入的正文默认覆盖", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    module002Workspace.documentFormat.secondTitle.bold = true;
    module002Workspace.documentFormat.secondTitle.firstLineIndentChars = 0;
    module002Workspace.templates[0].modules = module002Workspace.templates[0].modules.filter(
      (module002Module) => module002Module.type !== "hostClosing",
    );
    module002Workspace.templates[0].defaultPrompt = "正文：{{CURRENT_DOCUMENT_BODY}}\n人物：{{PERSON_CARDS}}\n发言顺序：\n{{SPEAKER_ORDER}}";
    module002Workspace.templates[0].modules[0].styleOverride = {
      bold: false,
      italic: false,
      underline: false,
      color: "#000000",
      align: "left",
      firstLineIndentChars: 0,
      leftIndentChars: 0,
      rightIndentChars: 0,
      lineSpacingPt: 28,
    };

    const module002Migrated = module002ParseWorkspaceConfig(
      JSON.stringify(module002Workspace),
    );
    expect(module002Migrated.templates[0].modules[0].styleOverride).toEqual({});
    expect(module002Migrated.documentFormat.secondTitle.bold).toBe(false);
    expect(module002Migrated.documentFormat.secondTitle.firstLineIndentChars).toBe(2);
    expect(module002Migrated.templates[0].modules.map((module002Module) => module002Module.type)).toContain("hostClosing");
    expect(module002Migrated.templates[0].defaultPrompt).not.toContain("SPEAKER_ORDER");
  });

  it("为历史草稿补入主持人总结模块并移除发言顺序占位符", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.templateSnapshot.modules = module002Draft.templateSnapshot.modules.filter(
      (module002Module) => module002Module.type !== "hostClosing",
    );
    module002Draft.prompt = "{{CURRENT_DOCUMENT_BODY}}\n{{PERSON_CARDS}}\n发言顺序：\n{{SPEAKER_ORDER}}";

    const module002Migrated = module002ParseDraft(JSON.stringify(module002Draft));
    expect(module002Migrated.templateSnapshot.modules.map((module002Module) => module002Module.type)).toContain("hostClosing");
    expect(module002Migrated.prompt).not.toContain("SPEAKER_ORDER");
  });

  it("仅为人员为空的第三党支部安全补入预制人员和默认 Prompt", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    module002Workspace.people = [];
    module002Workspace.templates[0].defaultPrompt = module002PlaceholderPrompt;
    module002Workspace.templates[0].defaults.hostPersonId = null;
    module002Workspace.templates[0].defaults.recorderPersonId = null;

    const module002Migrated = module002ParseWorkspaceConfig(
      JSON.stringify(module002Workspace),
    );
    expect(module002Migrated.people.map((item) => item.name)).toHaveLength(8);
    expect(module002Migrated.people[0].name).toBe("李万庄");
    expect(module002Migrated.people[7].name).toBe("李翔鲲");
    expect(module002Migrated.templates[0].defaultPrompt).toContain('"serialNumber"');
    expect(module002Migrated.templates[0].defaults).toMatchObject({
      hostPersonId: module002Migrated.people[0].id,
      recorderPersonId: module002Migrated.people[7].id,
    });

    module002Workspace.people = [{
      id: "person-manual",
      branchId: module002Workspace.branches[2].id,
      order: 0,
      name: "人工人物",
      values: {},
      isExample: false,
    }];
    module002Workspace.templates[0].defaultPrompt = "人工编辑的 Prompt";
    const module002Untouched = module002ParseWorkspaceConfig(
      JSON.stringify(module002Workspace),
    );
    expect(module002Untouched.people).toHaveLength(1);
    expect(module002Untouched.templates[0].defaultPrompt).toBe("人工编辑的 Prompt");
  });
});
