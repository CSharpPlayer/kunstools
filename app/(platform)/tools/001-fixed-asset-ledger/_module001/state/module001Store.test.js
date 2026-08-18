import { afterEach, describe, expect, it } from "vitest";
import {
  module001CompleteInitialization,
} from "../domain/module001ProjectCommands";
import { module001CreateReadyTestProject } from "../test/module001Fixtures";
import { module001UseStore } from "./module001Store";

/** 建立不会触碰浏览器锁服务的测试写锁。 */
function module001CreateTestLock() {
  return { isWriter: true, release() {} };
}

afterEach(() => {
  module001UseStore.getState().closeProject();
});

describe("module001 撤销与重做", () => {
  it("业务命令可一次撤销并以新修订号重做", () => {
    const { module001Project, module001Rows } =
      module001CreateReadyTestProject();
    module001CompleteInitialization(module001Project, module001Rows);
    module001UseStore.getState().setProjectSession({
      module001Project,
      module001ProjectDirectory: {},
      module001LockController: module001CreateTestLock(),
    });
    const module001AssetId = module001Project.assets[0].assetId;
    module001UseStore.getState().setSelectedAssetId(module001AssetId);
    module001UseStore.getState().runProjectCommand(
      "修改名称",
      (module001Draft) => {
        module001Draft.assets[0].name = "新名称";
      },
    );
    const module001EditedRevision =
      module001UseStore.getState().currentProject.revision;
    expect(module001UseStore.getState().currentProject.assets[0].name).toBe(
      "新名称",
    );

    module001UseStore.getState().undo();
    expect(module001UseStore.getState().currentProject.assets[0].name).toBe(
      "组合资产",
    );
    expect(module001UseStore.getState().selectedAssetId).toBe(module001AssetId);

    module001UseStore.getState().redo();
    expect(module001UseStore.getState().currentProject.assets[0].name).toBe(
      "新名称",
    );
    expect(module001UseStore.getState().currentProject.revision).toBeGreaterThan(
      module001EditedRevision,
    );
  });
});
