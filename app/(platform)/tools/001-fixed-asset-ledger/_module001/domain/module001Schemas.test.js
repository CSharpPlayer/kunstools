import { describe, expect, it } from "vitest";
import {
  module001MigrateProject,
  module001ParseProjectText,
} from "./module001Migrations";
import {
  module001CompleteInitialization,
} from "./module001ProjectCommands";
import { module001ProjectSchema } from "./module001Schemas";
import {
  module001CreateReadyTestProject,
  module001CreateTestProject,
} from "../test/module001Fixtures";

describe("module001 项目 schema 与迁移", () => {
  it("接受当前版本并完成 JSON 往返", () => {
    const module001Project = module001CreateTestProject();
    expect(
      module001ParseProjectText(JSON.stringify(module001Project)),
    ).toEqual(module001Project);
  });

  it("拒绝损坏 JSON、未知新版本和无迁移路径旧版本", () => {
    expect(() => module001ParseProjectText("{"))
      .toThrow("project.json 已损坏");
    expect(() =>
      module001MigrateProject({ projectFormatVersion: 99 }),
    ).toThrow("更新版本");
    expect(() =>
      module001MigrateProject({ projectFormatVersion: 0 }),
    ).toThrow("缺少迁移路径");
  });

  it("合并相同编号节点并保持双向关联有效", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);

    expect(module001Project.assets).toHaveLength(1);
    expect(module001Project.assets[0].modelNodeIds).toEqual([
      "node-a",
      "node-b",
    ]);
    expect(module001ProjectSchema.safeParse(module001Project).success).toBe(true);
  });

  it("拒绝同一模型节点被两项资产占用", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);
    module001Project.assets.push({
      ...structuredClone(module001Project.assets[0]),
      assetId: "asset-second",
      code: "002",
    });

    expect(module001ProjectSchema.safeParse(module001Project).success).toBe(false);
  });
});
