import { create } from "zustand";

const module001UndoLimit = 80;

/**
 * 定义模块 001 的会话状态和可撤销项目命令。
 */
function module001CreateStore(module001Set, module001Get) {
  return {
    workspaceHandle: null,
    workspace: null,
    projectDirectory: null,
    currentProject: null,
    lockController: null,
    isWriter: false,
    saveStatus: "idle",
    saveError: null,
    hoverAssetId: null,
    selectedAssetId: null,
    operation: null,
    undoStack: [],
    redoStack: [],

    /** 保存当前工作区连接和清单。 */
    setWorkspace(module001WorkspaceHandle, module001Workspace) {
      module001Set({
        workspaceHandle: module001WorkspaceHandle,
        workspace: module001Workspace,
      });
    },

    /** 只更新已经连接工作区的清单。 */
    setWorkspaceData(module001Workspace) {
      module001Set({ workspace: module001Workspace });
    },

    /** 打开一个经过校验并已取得锁状态的项目会话。 */
    setProjectSession({
      module001Project,
      module001ProjectDirectory,
      module001LockController,
    }) {
      module001Set({
        currentProject: module001Project,
        projectDirectory: module001ProjectDirectory,
        lockController: module001LockController,
        isWriter: Boolean(module001LockController?.isWriter),
        saveStatus: module001LockController?.isWriter ? "saved" : "readonly",
        saveError: null,
        hoverAssetId: null,
        selectedAssetId: null,
        undoStack: [],
        redoStack: [],
      });
    },

    /** 在只读标签页重新取得编辑锁后更新写入状态。 */
    setWriterLock(module001LockController) {
      module001Get().lockController?.release();
      module001Set({
        lockController: module001LockController,
        isWriter: Boolean(module001LockController?.isWriter),
        saveStatus: module001LockController?.isWriter ? "dirty" : "readonly",
        saveError: module001LockController?.reason ?? null,
      });
    },

    /** 关闭项目、释放锁并清理当前会话状态。 */
    closeProject() {
      module001Get().lockController?.release();
      module001Set({
        currentProject: null,
        projectDirectory: null,
        lockController: null,
        isWriter: false,
        saveStatus: "idle",
        saveError: null,
        hoverAssetId: null,
        selectedAssetId: null,
        undoStack: [],
        redoStack: [],
      });
    },

    /** 更新三维与台账共享的临时悬停资产。 */
    setHoverAssetId(module001AssetId) {
      module001Set({ hoverAssetId: module001AssetId });
    },

    /** 更新持续选中资产。 */
    setSelectedAssetId(module001AssetId) {
      module001Set({ selectedAssetId: module001AssetId });
    },

    /** 更新保存状态和可恢复错误。 */
    setSaveState(module001SaveStatus, module001SaveError = null) {
      module001Set({
        saveStatus: module001SaveStatus,
        saveError: module001SaveError,
      });
    },

    /** 更新耗时操作的阶段和进度。 */
    setOperation(module001Operation) {
      module001Set({ operation: module001Operation });
    },

    /** 用新的磁盘版本替换项目而不写入撤销历史。 */
    replaceProject(module001Project) {
      module001Set({ currentProject: module001Project });
    },

    /** 运行一次可撤销项目命令，并生成新的项目修订号。 */
    runProjectCommand(module001Label, module001Mutator) {
      const module001State = module001Get();

      if (!module001State.currentProject || !module001State.isWriter) {
        return false;
      }

      const module001Before = structuredClone(module001State.currentProject);
      const module001After = structuredClone(module001State.currentProject);
      module001Mutator(module001After);
      module001After.revision = module001Before.revision + 1;
      module001After.updatedAt = new Date().toISOString();

      module001Set({
        currentProject: module001After,
        saveStatus: "dirty",
        saveError: null,
        undoStack: [
          ...module001State.undoStack,
          { label: module001Label, project: module001Before },
        ].slice(-module001UndoLimit),
        redoStack: [],
      });
      return true;
    },

    /** 更新布局、筛选等项目界面设置，不占用业务撤销历史。 */
    updateProjectUi(module001Mutator) {
      const module001State = module001Get();

      if (!module001State.currentProject || !module001State.isWriter) {
        return false;
      }

      const module001After = structuredClone(module001State.currentProject);
      module001Mutator(module001After);
      module001After.revision = module001State.currentProject.revision + 1;
      module001After.updatedAt = new Date().toISOString();
      module001Set({
        currentProject: module001After,
        saveStatus: "dirty",
        saveError: null,
      });
      return true;
    },

    /** 撤销最近一次业务命令。 */
    undo() {
      const module001State = module001Get();
      const module001Entry = module001State.undoStack.at(-1);

      if (!module001Entry || !module001State.currentProject || !module001State.isWriter) {
        return;
      }

      const module001Previous = structuredClone(module001Entry.project);
      module001Previous.revision = module001State.currentProject.revision + 1;
      module001Previous.updatedAt = new Date().toISOString();
      module001Set({
        currentProject: module001Previous,
        saveStatus: "dirty",
        undoStack: module001State.undoStack.slice(0, -1),
        redoStack: [
          ...module001State.redoStack,
          {
            label: module001Entry.label,
            project: structuredClone(module001State.currentProject),
          },
        ].slice(-module001UndoLimit),
      });
    },

    /** 重做最近一次被撤销的业务命令。 */
    redo() {
      const module001State = module001Get();
      const module001Entry = module001State.redoStack.at(-1);

      if (!module001Entry || !module001State.currentProject || !module001State.isWriter) {
        return;
      }

      const module001Next = structuredClone(module001Entry.project);
      module001Next.revision = module001State.currentProject.revision + 1;
      module001Next.updatedAt = new Date().toISOString();
      module001Set({
        currentProject: module001Next,
        saveStatus: "dirty",
        redoStack: module001State.redoStack.slice(0, -1),
        undoStack: [
          ...module001State.undoStack,
          {
            label: module001Entry.label,
            project: structuredClone(module001State.currentProject),
          },
        ].slice(-module001UndoLimit),
      });
    },
  };
}

export const module001UseStore = create(module001CreateStore);
