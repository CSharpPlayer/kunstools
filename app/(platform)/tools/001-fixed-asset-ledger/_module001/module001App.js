"use client";

import { HardDrive, ShieldAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import Module001Dialog from "./components/module001Dialog";
import Module001OperationOverlay from "./components/module001OperationOverlay";
import {
  module001ChooseZipSaveHandle,
  module001ExportProjectZip,
  module001ImportProjectZip,
  module001InspectProjectZip,
} from "./export/module001Zip";
import { useModule001Autosave } from "./state/module001Autosave";
import { module001UseStore } from "./state/module001Store";
import {
  module001OpenOrCreateWorkspace,
} from "./workspace/module001FileSystem";
import {
  platformEnsureWorkspacePermission,
  platformGetWorkspaceCapability,
  platformOpenModuleWorkspace,
  platformReadRememberedWorkspace,
} from "../../../_platform/workspace/platformWorkspace";
import { platformGetModuleWorkspaceFolderName } from "../../../_platform/platformModuleCatalog";
import { module001AcquireProjectLock } from "./workspace/module001ProjectLock";
import { module001OpenProjectFromSummary } from "./workspace/module001ProjectRepository";

const Module001ProjectCenter = dynamic(
  () => import("./projectCenter/module001ProjectCenter"),
  { loading: () => <Module001SectionLoading /> },
);
const Module001Initialization = dynamic(
  () => import("./import/module001Initialization"),
  { ssr: false, loading: () => <Module001SectionLoading /> },
);
const Module001Workspace = dynamic(
  () => import("./workspace/module001Workspace"),
  { ssr: false, loading: () => <Module001SectionLoading /> },
);

/** 展示模块内按需代码加载状态。 */
function Module001SectionLoading() {
  return (
    <div className="module001CenteredState" role="status">
      <span className="module001Spin" aria-hidden="true" />
      <span>正在准备本地工作区</span>
    </div>
  );
}

/** 把异常转换成不包含项目数据的安全中文说明。 */
function module001SafeError(module001Error, module001Fallback) {
  if (module001Error?.name === "AbortError") return "操作已取消";
  return module001Error instanceof Error
    ? module001Error.message
    : module001Fallback;
}

/** 连接本地工作区，并在项目中心和项目会话之间切换。 */
export default function Module001App() {
  const module001WorkspaceHandle = module001UseStore(
    (module001State) => module001State.workspaceHandle,
  );
  const module001Workspace = module001UseStore(
    (module001State) => module001State.workspace,
  );
  const module001CurrentProject = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001SaveStatus = module001UseStore(
    (module001State) => module001State.saveStatus,
  );
  const module001Operation = module001UseStore(
    (module001State) => module001State.operation,
  );
  const module001SetWorkspace = module001UseStore(
    (module001State) => module001State.setWorkspace,
  );
  const module001SetWorkspaceData = module001UseStore(
    (module001State) => module001State.setWorkspaceData,
  );
  const module001SetProjectSession = module001UseStore(
    (module001State) => module001State.setProjectSession,
  );
  const module001SetSelectedAssetId = module001UseStore(
    (module001State) => module001State.setSelectedAssetId,
  );
  const module001SetOperation = module001UseStore(
    (module001State) => module001State.setOperation,
  );
  const module001Undo = module001UseStore(
    (module001State) => module001State.undo,
  );
  const module001Redo = module001UseStore(
    (module001State) => module001State.redo,
  );
  const [module001BootStatus, setModule001BootStatus] = useState("checking");
  const [module001Error, setModule001Error] = useState(null);
  const [module001PendingImport, setModule001PendingImport] = useState(null);

  useModule001Autosave();

  useEffect(() => {
    let module001Cancelled = false;

    /** 尝试无弹窗恢复已授权的目录句柄。 */
    async function module001RestoreWorkspace() {
      const module001Capability = platformGetWorkspaceCapability();
      if (!module001Capability.supported) {
        setModule001Error(module001Capability.reason);
        setModule001BootStatus("unsupported");
        return;
      }

      try {
        const module001Record = await platformReadRememberedWorkspace();
        if (module001Cancelled) return;
        if (!module001Record?.handle) {
          setModule001BootStatus("disconnected");
          return;
        }

        const module001Granted = await platformEnsureWorkspacePermission(
          module001Record.handle,
          false,
        );
        if (!module001Granted) {
          setModule001BootStatus("permission-required");
          return;
        }

        const module001FolderName = platformGetModuleWorkspaceFolderName("001");
        if (!module001FolderName) {
          throw new Error("001 shared workspace folder is not configured");
        }
        const module001ModuleHandle = await platformOpenModuleWorkspace(
          module001Record.handle,
          module001FolderName,
        );
        const module001RestoredWorkspace =
          await module001OpenOrCreateWorkspace(module001ModuleHandle);
        if (
          module001Record.workspaceId &&
          module001RestoredWorkspace.workspaceId !== module001Record.workspaceId
        ) {
          throw new Error("保存的目录句柄与原工作区标记不一致");
        }
        module001SetWorkspace(module001ModuleHandle, module001RestoredWorkspace);
        setModule001BootStatus("connected");
      } catch (module001RestoreError) {
        if (!module001Cancelled) {
          setModule001Error(
            module001SafeError(module001RestoreError, "恢复工作区失败"),
          );
          setModule001BootStatus("permission-required");
        }
      }
    }

    module001RestoreWorkspace();
    return () => {
      module001Cancelled = true;
    };
  }, [module001SetWorkspace]);

  useEffect(() => {
    /** 处理项目级撤销、重做和清除持续选择。 */
    function module001HandleKeyboard(module001Event) {
      const module001Target = module001Event.target;
      const module001Editing =
        module001Target instanceof HTMLElement &&
        (module001Target.isContentEditable ||
          ["INPUT", "SELECT", "TEXTAREA"].includes(module001Target.tagName));

      if (module001Event.key === "Escape") {
        module001SetSelectedAssetId(null);
        return;
      }
      if (module001Editing || !(module001Event.ctrlKey || module001Event.metaKey)) {
        return;
      }
      if (module001Event.key.toLowerCase() === "z") {
        module001Event.preventDefault();
        module001Event.shiftKey ? module001Redo() : module001Undo();
      } else if (module001Event.key.toLowerCase() === "y") {
        module001Event.preventDefault();
        module001Redo();
      }
    }

    window.addEventListener("keydown", module001HandleKeyboard);
    return () => window.removeEventListener("keydown", module001HandleKeyboard);
  }, [module001Redo, module001SetSelectedAssetId, module001Undo]);

  useEffect(() => {
    if (!["dirty", "saving", "error"].includes(module001SaveStatus)) {
      return undefined;
    }

    /** 避免带有未保存修改的浏览器标签被误关闭。 */
    function module001WarnBeforeUnload(module001Event) {
      module001Event.preventDefault();
      module001Event.returnValue = "";
    }

    window.addEventListener("beforeunload", module001WarnBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", module001WarnBeforeUnload);
  }, [module001SaveStatus]);

  /** 从项目中心流式导出指定项目包。 */
  async function module001ExportProject(module001Summary) {
    let module001SaveHandle;
    try {
      module001SaveHandle = await module001ChooseZipSaveHandle(
        module001Summary.displayName,
      );
    } catch (module001ChooseError) {
      if (module001ChooseError?.name !== "AbortError") {
        setModule001Error(
          module001SafeError(module001ChooseError, "无法选择保存位置"),
        );
      }
      return;
    }

    const module001AbortController = new AbortController();
    module001SetOperation({
      title: "正在导出项目 ZIP",
      detail: module001Summary.displayName,
      ratio: 0,
      cancelable: true,
      onCancel: () => module001AbortController.abort(),
    });
    try {
      const module001Opened = await module001OpenProjectFromSummary(
        module001WorkspaceHandle,
        module001Summary,
      );
      await module001ExportProjectZip({
        module001Project: module001Opened.project,
        module001ProjectDirectory: module001Opened.projectDirectory,
        module001SaveHandle,
        module001Signal: module001AbortController.signal,
        module001OnProgress: ({ fileName, ratio }) =>
          module001SetOperation({
            title: "正在导出项目 ZIP",
            detail: fileName === "complete" ? "即将完成" : fileName,
            ratio,
            cancelable: fileName !== "complete",
            onCancel: () => module001AbortController.abort(),
          }),
      });
    } catch (module001ExportError) {
      setModule001Error(
        module001SafeError(module001ExportError, "ZIP 导出失败"),
      );
    } finally {
      module001SetOperation(null);
    }
  }

  /** 检查用户选择的 ZIP，并在编号冲突时先显示覆盖选择。 */
  async function module001InspectImport(module001ZipFile) {
    setModule001Error(null);
    module001SetOperation({
      title: "正在检查项目 ZIP",
      detail: "验证清单、路径、大小和项目数据",
      ratio: 0.2,
      cancelable: false,
    });
    try {
      const module001Inspection =
        await module001InspectProjectZip(module001ZipFile);
      const module001Existing = module001Workspace.projects.find(
        (module001Summary) =>
          module001Summary.projectId === module001Inspection.project.projectId,
      );
      if (module001Existing) {
        setModule001PendingImport({
          file: module001ZipFile,
          inspection: module001Inspection,
          existing: module001Existing,
        });
      } else {
        await module001RunImport(module001ZipFile, module001Inspection, "copy");
      }
    } catch (module001ImportError) {
      setModule001Error(
        module001SafeError(module001ImportError, "ZIP 检查失败"),
      );
    } finally {
      module001SetOperation(null);
    }
  }

  /** 将已验证项目写入临时目录，成功登记后直接打开。 */
  async function module001RunImport(
    module001ZipFile,
    module001Inspection,
    module001ConflictStrategy,
  ) {
    const module001AbortController = new AbortController();
    let module001PreliminaryLock = null;
    setModule001PendingImport(null);
    module001SetOperation({
      title: "正在导入项目 ZIP",
      detail: "准备本地临时项目目录",
      ratio: 0,
      cancelable: true,
      onCancel: () => module001AbortController.abort(),
    });
    try {
      if (module001ConflictStrategy === "overwrite") {
        module001PreliminaryLock = await module001AcquireProjectLock(
          module001Inspection.project.projectId,
        );
        if (!module001PreliminaryLock.isWriter) {
          module001PreliminaryLock.release();
          module001PreliminaryLock = null;
          throw new Error("该项目正在另一标签页中编辑，暂时不能覆盖");
        }
      }

      const module001Imported = await module001ImportProjectZip({
        module001ZipFile,
        module001Inspection,
        module001WorkspaceHandle,
        module001Workspace,
        module001ConflictStrategy,
        module001Signal: module001AbortController.signal,
        module001OnProgress: ({ fileName, ratio }) =>
          module001SetOperation({
            title: "正在导入项目 ZIP",
            detail: fileName === "complete" ? "完成项目校验" : fileName,
            ratio,
            cancelable: fileName !== "complete",
            onCancel: () => module001AbortController.abort(),
          }),
      });
      module001SetWorkspaceData(module001Imported.workspace);
      const module001LockController =
        module001PreliminaryLock ??
        (await module001AcquireProjectLock(
          module001Imported.project.projectId,
        ));
      module001PreliminaryLock = null;
      module001SetProjectSession({
        module001Project: module001Imported.project,
        module001ProjectDirectory: module001Imported.projectDirectory,
        module001LockController,
      });
    } catch (module001ImportError) {
      module001PreliminaryLock?.release();
      setModule001Error(
        module001SafeError(module001ImportError, "ZIP 导入失败"),
      );
    } finally {
      module001SetOperation(null);
    }
  }

  if (module001BootStatus === "checking") return <Module001SectionLoading />;

  if (module001BootStatus === "unsupported") {
    return (
      <section className="module001CenteredState" role="alert">
        <ShieldAlert size={32} aria-hidden="true" />
        <strong>当前浏览器无法使用本地工作区</strong>
        <span>{module001Error}</span>
      </section>
    );
  }

  if (!module001WorkspaceHandle || !module001Workspace) {
    const module001PermissionRequired =
      module001BootStatus === "permission-required";
    return (
      <section className="module001ConnectView">
        <div className="module001ConnectCard">
          <span className="module001ConnectIcon" aria-hidden="true">
            <HardDrive size={30} />
          </span>
          <h1>001 可视化固定资产管理台账</h1>
          <p>
            {module001PermissionRequired
              ? "本地工作区需要重新授权，请返回主页完成授权。"
              : "请先在主页选择本地工作区；项目数据不会上传。"}
          </p>
          {module001Error ? (
            <div className="module001InlineError" role="alert">
              {module001Error}
            </div>
          ) : null}
          <div className="module001ConnectActions">
            <Link className="module001PrimaryButton" href="/" scroll={false}>
              返回主页设置本地工作区
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="module001App">
      {module001Error ? (
        <div className="module001GlobalError" role="alert">
          <span>{module001Error}</span>
          <button
            aria-label="关闭错误提示"
            onClick={() => setModule001Error(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {module001CurrentProject ? (
        module001CurrentProject.initializationStatus === "draft" ? (
          <Module001Initialization />
        ) : (
          <Module001Workspace />
        )
      ) : (
        <Module001ProjectCenter
          module001OnExportProject={module001ExportProject}
          module001OnImportProject={module001InspectImport}
        />
      )}

      <Module001OperationOverlay
        module001Operation={module001Operation}
        module001OnCancel={() => module001Operation?.onCancel?.()}
      />

      <Module001Dialog
        module001Description="默认另存为副本；覆盖会在新项目完整校验后才移除旧目录。"
        module001Open={Boolean(module001PendingImport)}
        module001OnClose={() => setModule001PendingImport(null)}
        module001Title="发现相同项目编号"
        module001Children={
          module001PendingImport ? (
            <div className="module001ImportConflict">
              <div>
                <span>本地项目</span>
                <strong>{module001PendingImport.existing.displayName}</strong>
              </div>
              <div>
                <span>导入项目</span>
                <strong>
                  {module001PendingImport.inspection.project.displayName}
                </strong>
              </div>
            </div>
          ) : null
        }
        module001Footer={
          module001PendingImport ? (
            <>
              <button
                className="module001SecondaryButton"
                onClick={() => setModule001PendingImport(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="module001PrimaryButton"
                onClick={() =>
                  module001RunImport(
                    module001PendingImport.file,
                    module001PendingImport.inspection,
                    "copy",
                  )
                }
                type="button"
              >
                另存为副本
              </button>
              <button
                className="module001DangerButton"
                onClick={() =>
                  module001RunImport(
                    module001PendingImport.file,
                    module001PendingImport.inspection,
                    "overwrite",
                  )
                }
                type="button"
              >
                覆盖本地项目
              </button>
            </>
          ) : null
        }
      />
    </div>
  );
}
