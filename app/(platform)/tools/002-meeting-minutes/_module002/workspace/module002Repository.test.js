import { describe, expect, it } from "vitest";
import {
  module002LoadCurrentDraft,
  module002OpenOrCreateWorkspace,
  module002SaveCurrentDraft,
} from "./module002Repository";
import { module002CreateDraft, module002CreateInitialWorkspace } from "../domain/module002Factories";

/** 用内存文件句柄验证两阶段写入，不触碰真实磁盘。 */
function module002CreateMemoryDirectory() {
  const module002Files = new Map();
  return {
    files: module002Files,
    async getFileHandle(module002Name, module002Options = {}) {
      if (!module002Files.has(module002Name) && !module002Options.create) {
        throw new DOMException("Not found", "NotFoundError");
      }
      return {
        async getFile() {
          const module002Value = module002Files.get(module002Name) ?? new Uint8Array();
          return new File([module002Value], module002Name);
        },
        async createWritable() {
          return {
            async write(module002Value) {
              module002Files.set(module002Name, module002Value);
            },
            async close() {},
            async abort() {},
          };
        },
      };
    },
    async removeEntry(module002Name) {
      if (!module002Files.delete(module002Name)) {
        throw new DOMException("Not found", "NotFoundError");
      }
    },
  };
}

describe("module002 local workspace", () => {
  it("初始化版本化配置并安全保存唯一草稿", async () => {
    const module002Directory = module002CreateMemoryDirectory();
    const { config } = await module002OpenOrCreateWorkspace(module002Directory);
    const module002Draft = module002CreateDraft({
      module002Template: config.templates[0],
      module002DocumentFormat: config.documentFormat,
      module002People: config.people,
    });
    await module002SaveCurrentDraft(module002Directory, module002Draft);

    expect(module002Directory.files.has("module002-config.json")).toBe(true);
    expect(module002Directory.files.has("module002-current-draft.json")).toBe(true);
    expect(module002Directory.files.has("module002-current-draft.recovery.json")).toBe(true);
  });

  it("主配置损坏时读取有效恢复副本而不覆盖原文件", async () => {
    const module002Directory = module002CreateMemoryDirectory();
    const module002Recovery = module002CreateInitialWorkspace();
    module002Recovery.revision = 7;
    module002Directory.files.set("module002-config.json", "{损坏");
    module002Directory.files.set(
      "module002-config.recovery.json",
      JSON.stringify(module002Recovery),
    );
    const module002Loaded = await module002OpenOrCreateWorkspace(module002Directory);
    expect(module002Loaded.recovered).toBe(true);
    expect(module002Loaded.config.revision).toBe(7);
    expect(module002Directory.files.get("module002-config.json")).toBe("{损坏");
  });

  it("两份配置均损坏时明确报错且不静默建立空工作区", async () => {
    const module002Directory = module002CreateMemoryDirectory();
    module002Directory.files.set("module002-config.json", "{损坏");
    module002Directory.files.set("module002-config.recovery.json", "{也损坏");
    await expect(module002OpenOrCreateWorkspace(module002Directory)).rejects.toThrow(
      "工作区配置已损坏",
    );
    expect(module002Directory.files.has("module002-manifest.json")).toBe(false);
  });

  it("两份草稿均损坏时不伪装为没有草稿", async () => {
    const module002Directory = module002CreateMemoryDirectory();
    module002Directory.files.set("module002-current-draft.json", "{损坏");
    module002Directory.files.set("module002-current-draft.recovery.json", "{也损坏");
    await expect(module002LoadCurrentDraft(module002Directory)).rejects.toThrow(
      "当前草稿已损坏",
    );
  });
});
