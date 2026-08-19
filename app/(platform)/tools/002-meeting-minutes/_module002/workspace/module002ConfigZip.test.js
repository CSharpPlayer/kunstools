import { describe, expect, it } from "vitest";
import { module002CreateInitialWorkspace } from "../domain/module002Factories";
import {
  module002CreateConfigZip,
  module002InspectConfigZip,
  module002MergeImportedConfig,
} from "./module002ConfigZip";

/** 创建指定条目的合成 ZIP，用于验证缺项、旧版和路径穿越。 */
async function module002CreateRawZip(module002Entries) {
  const {
    BlobWriter: Module002BlobWriter,
    TextReader: Module002TextReader,
    ZipWriter: Module002ZipWriter,
  } = await import("@zip.js/zip.js");
  const module002Writer = new Module002ZipWriter(
    new Module002BlobWriter("application/zip"),
  );
  for (const [module002Name, module002Value] of module002Entries) {
    await module002Writer.add(
      module002Name,
      new Module002TextReader(JSON.stringify(module002Value)),
    );
  }
  return new File([await module002Writer.close()], "config.zip", {
    type: "application/zip",
  });
}

describe("module002 configuration ZIP", () => {
  it("导出的配置包可以重新校验且不含草稿字段", async () => {
    const module002Config = module002CreateInitialWorkspace();
    const module002Blob = await module002CreateConfigZip(module002Config);
    const module002Inspection = await module002InspectConfigZip(
      new File([module002Blob], "config.zip", { type: "application/zip" }),
    );
    expect(module002Inspection.config.workspaceId).toBe(module002Config.workspaceId);
    expect(JSON.stringify(module002Inspection.config)).not.toContain("currentDraft");
    expect(JSON.stringify(module002Inspection.config)).not.toContain("API_KEY");
  });

  it("默认保留本机冲突并可单独导入格式", () => {
    const module002Local = module002CreateInitialWorkspace();
    const module002Imported = structuredClone(module002Local);
    module002Imported.documentFormat.marginTopCm = 3.2;
    module002Imported.templates[0].name = "导入版名称";
    const module002Merged = module002MergeImportedConfig({
      module002Local,
      module002Imported,
      module002Selection: {
        templates: false,
        people: false,
        personFields: false,
        documentFormat: true,
        prompts: false,
        settings: false,
      },
    });
    expect(module002Merged.documentFormat.marginTopCm).toBe(3.2);
    expect(module002Merged.templates[0].name).toBe("党员大会");
  });

  it("拒绝缺少配置文件、损坏包和路径穿越条目", async () => {
    const module002Manifest = {
      package: "kunstools-module002-configuration",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      workspaceId: "workspace-test",
    };
    await expect(
      module002InspectConfigZip(
        await module002CreateRawZip([["manifest.json", module002Manifest]]),
      ),
    ).rejects.toThrow("文件数量不正确");
    await expect(
      module002InspectConfigZip(
        new File(["不是 ZIP"], "config.zip", { type: "application/zip" }),
      ),
    ).rejects.toThrow();
    await expect(
      module002InspectConfigZip(
        await module002CreateRawZip([
          ["manifest.json", module002Manifest],
          ["../configuration.json", module002CreateInitialWorkspace()],
        ]),
      ),
    ).rejects.toThrow("不允许的条目");
  });

  it("拒绝旧 schema 且不改变调用方本机配置", async () => {
    const module002Local = module002CreateInitialWorkspace();
    const module002Snapshot = JSON.stringify(module002Local);
    const module002Old = structuredClone(module002Local);
    module002Old.formatVersion = 0;
    await expect(
      module002InspectConfigZip(
        await module002CreateRawZip([
          ["manifest.json", {
            package: "kunstools-module002-configuration",
            formatVersion: 0,
            exportedAt: new Date().toISOString(),
            workspaceId: module002Old.workspaceId,
          }],
          ["configuration.json", module002Old],
        ]),
      ),
    ).rejects.toThrow();
    expect(JSON.stringify(module002Local)).toBe(module002Snapshot);
  });

  it("冲突项可另存为稳定的新副本", () => {
    const module002Local = module002CreateInitialWorkspace();
    const module002Imported = structuredClone(module002Local);
    const module002ImportedTemplate = module002Imported.templates[0];
    const module002Merged = module002MergeImportedConfig({
      module002Local,
      module002Imported,
      module002Selection: {
        templates: true,
        people: false,
        personFields: false,
        documentFormat: false,
        prompts: false,
        settings: false,
      },
      module002Decisions: {
        [`templates:${module002ImportedTemplate.id}`]: "copy",
      },
    });
    expect(module002Merged.templates).toHaveLength(
      module002Local.templates.length + 1,
    );
    const module002ImportedCopy = module002Merged.templates.find(
      (module002Template) => module002Template.name.includes("导入副本"),
    );
    expect(module002ImportedCopy).toBeDefined();
    expect(module002ImportedCopy.id).not.toBe(module002ImportedTemplate.id);
    expect(module002ImportedCopy.modules[0].id).not.toBe(
      module002ImportedTemplate.modules[0].id,
    );
  });
});
