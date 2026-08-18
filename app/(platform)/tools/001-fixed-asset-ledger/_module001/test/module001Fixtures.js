import { module001CreateProject } from "../domain/module001Factories";

/** 建立不包含真实业务数据的模块测试项目。 */
export function module001CreateTestProject() {
  return module001CreateProject({
    module001ProjectId: "project-test-001",
    module001DisplayName: "测试库区",
    module001ModelFile: { name: "test.glb", size: 128 },
    module001Inspection: {
      sceneCount: 1,
      topLevelNodeCount: 3,
      candidateNodeCount: 2,
      extensionsUsed: [],
      extensionsRequired: [],
      modelNodes: [
        {
          modelNodeId: "node-a",
          sourceName: "立方体 A",
          displayPath: "顶层对象 1 / 立方体 A",
          topLevelIndex: 0,
          sceneNodeOrdinal: 0,
          meshDescendantCount: 1,
          isCandidate: true,
          isAssetObject: false,
          visible: true,
          assetId: null,
        },
        {
          modelNodeId: "node-b",
          sourceName: "立方体 B",
          displayPath: "顶层对象 2 / 立方体 B",
          topLevelIndex: 1,
          sceneNodeOrdinal: 1,
          meshDescendantCount: 1,
          isCandidate: true,
          isAssetObject: false,
          visible: true,
          assetId: null,
        },
        {
          modelNodeId: "node-scene",
          sourceName: "地面",
          displayPath: "顶层对象 3 / 地面",
          topLevelIndex: 2,
          sceneNodeOrdinal: 2,
          meshDescendantCount: 0,
          isCandidate: false,
          isAssetObject: false,
          visible: true,
          assetId: null,
        },
      ],
    },
  });
}

/** 把测试项目初始化成一项关联两个节点的有效资产。 */
export function module001CreateReadyTestProject() {
  const module001Project = module001CreateTestProject();
  const module001Category = module001Project.categories[0];
  const module001Rows = [
    {
      modelNodeId: "node-a",
      selected: true,
      code: "001",
      name: "组合资产",
      categoryId: module001Category.categoryId,
      color: module001Category.defaultColor,
    },
    {
      modelNodeId: "node-b",
      selected: true,
      code: "001",
      name: "组合资产",
      categoryId: module001Category.categoryId,
      color: module001Category.defaultColor,
    },
  ];

  return { module001Project, module001Rows };
}
