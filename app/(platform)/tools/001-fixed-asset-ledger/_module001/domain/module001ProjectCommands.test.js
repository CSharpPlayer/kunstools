import { describe, expect, it } from "vitest";
import {
  module001AddCustomField,
  module001CompleteInitialization,
  module001DeleteAsset,
  module001MergeAssets,
  module001SplitAsset,
} from "./module001ProjectCommands";
import {
  module001CreateReadyTestProject,
  module001CreateTestProject,
} from "../test/module001Fixtures";

describe("module001 资产命令", () => {
  it("删除资产后释放全部模型节点", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);
    module001DeleteAsset(module001Project, module001Project.assets[0].assetId);

    expect(module001Project.assets).toHaveLength(0);
    expect(
      module001Project.modelNodes.filter(
        (module001Node) => module001Node.isCandidate,
      ),
    ).toSatisfy((module001Nodes) =>
      module001Nodes.every((module001Node) => !module001Node.assetId),
    );
  });

  it("拆分时保留原类别并把节点转给新资产", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);
    const module001Source = module001Project.assets[0];
    const module001Created = module001SplitAsset(
      module001Project,
      module001Source.assetId,
      {
        module001NodeIds: ["node-b"],
        module001Code: "002",
        module001Name: "拆分资产",
        module001CustomValues: {},
      },
    );

    expect(module001Created.categoryId).toBe(module001Source.categoryId);
    expect(module001Source.modelNodeIds).toEqual(["node-a"]);
    expect(
      module001Project.modelNodes.find(
        (module001Node) => module001Node.modelNodeId === "node-b",
      ).assetId,
    ).toBe(module001Created.assetId);
  });

  it("合并时允许明确恢复继承类别颜色", () => {
    const module001Project = module001CreateTestProject();
    const module001Category = module001Project.categories[0];
    module001CompleteInitialization(module001Project, [
      {
        modelNodeId: "node-a",
        selected: true,
        code: "001",
        name: "资产 A",
        categoryId: module001Category.categoryId,
        color: "#ff0000",
      },
      {
        modelNodeId: "node-b",
        selected: true,
        code: "002",
        name: "资产 B",
        categoryId: module001Category.categoryId,
        color: "#00ff00",
      },
    ]);
    const [module001Target, module001Source] = module001Project.assets;
    module001MergeAssets(
      module001Project,
      module001Target.assetId,
      module001Source.assetId,
      { highlightColorOverride: null },
    );

    expect(module001Target.highlightColorOverride).toBeNull();
    expect(module001Target.modelNodeIds).toHaveLength(2);
  });

  it("已有资产时阻止无默认值的必填字段", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);

    expect(() =>
      module001AddCustomField(module001Project, {
        name: "责任人",
        type: "text",
        required: true,
        defaultValue: null,
        options: [],
      }),
    ).toThrow("必须提供");
  });
});
