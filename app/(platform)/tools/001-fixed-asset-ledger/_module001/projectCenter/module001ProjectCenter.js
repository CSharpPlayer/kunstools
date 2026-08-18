"use client";

import {
  ArchiveRestore,
  Box,
  Copy,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Module001Dialog from "../components/module001Dialog";
import { module001AcquireProjectLock } from "../workspace/module001ProjectLock";
import {
  module001CopyProjectOnDisk,
  module001CreateProjectOnDisk,
  module001GetProjectDirectory,
  module001OpenProjectFromSummary,
  module001PermanentlyDeleteProject,
  module001RenameProjectOnDisk,
  module001SetProjectTrashed,
} from "../workspace/module001ProjectRepository";
import { module001UseStore } from "../state/module001Store";

/**
 * 将文件大小转换成适合项目卡片显示的短文本。
 */
function module001FormatBytes(module001Bytes) {
  if (module001Bytes < 1024) {
    return `${module001Bytes} B`;
  }

  if (module001Bytes < 1024 * 1024) {
    return `${(module001Bytes / 1024).toFixed(1)} KB`;
  }

  return `${(module001Bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 将 ISO 时间转换成简洁的本地更新时间。
 */
function module001FormatDate(module001Value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(module001Value));
}

/** 从授权目录读取项目封面，并在卡片卸载时释放对象网址。 */
function Module001ProjectPreview({
  module001WorkspaceHandle,
  module001Summary,
}) {
  const [module001PreviewUrl, setModule001PreviewUrl] = useState(null);

  useEffect(() => {
    let module001Url = null;
    let module001Cancelled = false;

    /** 打开项目内 preview.png，不读取模型或完整台账。 */
    async function module001OpenPreview() {
      try {
        const module001Directory = await module001GetProjectDirectory(
          module001WorkspaceHandle,
          module001Summary.directoryName,
        );
        const module001Handle = await module001Directory.getFileHandle(
          "preview.png",
        );
        module001Url = URL.createObjectURL(await module001Handle.getFile());
        if (!module001Cancelled) setModule001PreviewUrl(module001Url);
      } catch {
        // 缺失或损坏封面时保留轻量模型占位图标。
      }
    }

    module001OpenPreview();
    return () => {
      module001Cancelled = true;
      if (module001Url) URL.revokeObjectURL(module001Url);
    };
  }, [module001Summary.directoryName, module001WorkspaceHandle]);

  return (
    <div className="module001ProjectPreview">
      {module001PreviewUrl ? (
        // 本地 blob 封面不经过服务器，不能使用 Next 图片优化管线。
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={module001PreviewUrl} />
      ) : (
        <Box size={30} strokeWidth={1.5} aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * 渲染本地项目中心及其新建、复制、重命名和回收站操作。
 */
export default function Module001ProjectCenter({
  module001OnExportProject,
  module001OnImportProject,
}) {
  const module001WorkspaceHandle = module001UseStore(
    (module001State) => module001State.workspaceHandle,
  );
  const module001Workspace = module001UseStore(
    (module001State) => module001State.workspace,
  );
  const module001SetWorkspaceData = module001UseStore(
    (module001State) => module001State.setWorkspaceData,
  );
  const module001SetProjectSession = module001UseStore(
    (module001State) => module001State.setProjectSession,
  );
  const module001SetOperation = module001UseStore(
    (module001State) => module001State.setOperation,
  );
  const [module001ShowTrash, setModule001ShowTrash] = useState(false);
  const [module001Dialog, setModule001Dialog] = useState(null);
  const [module001Error, setModule001Error] = useState(null);
  const [module001ProjectName, setModule001ProjectName] = useState("");
  const [module001ModelFile, setModule001ModelFile] = useState(null);
  const [module001DeleteText, setModule001DeleteText] = useState("");
  const module001AbortRef = useRef(null);
  const module001ZipInputRef = useRef(null);

  const module001Projects = (module001Workspace?.projects ?? [])
    .filter((module001Project) =>
      module001ShowTrash
        ? Boolean(module001Project.trashedAt)
        : !module001Project.trashedAt,
    )
    .sort(
      (module001Left, module001Right) =>
        new Date(module001Right.updatedAt) - new Date(module001Left.updatedAt),
    );

  /** 将更新后的清单同步到状态和句柄缓存。 */
  async function module001CommitWorkspace(module001NextWorkspace) {
    module001SetWorkspaceData(module001NextWorkspace);
  }

  /** 打开项目并取得单标签写锁，未取得时以只读方式打开。 */
  async function module001OpenProject(module001Summary) {
    setModule001Error(null);

    try {
      const module001Opened = await module001OpenProjectFromSummary(
        module001WorkspaceHandle,
        module001Summary,
      );
      const module001LockController = await module001AcquireProjectLock(
        module001Opened.project.projectId,
      );
      module001SetProjectSession({
        module001Project: module001Opened.project,
        module001ProjectDirectory: module001Opened.projectDirectory,
        module001LockController,
      });
    } catch (module001OpenError) {
      setModule001Error(
        module001OpenError instanceof Error
          ? module001OpenError.message
          : "项目打开失败",
      );
    }
  }

  /** 新建项目并流式复制所选 GLB。 */
  async function module001CreateProject(module001Event) {
    module001Event.preventDefault();
    setModule001Error(null);

    if (!module001ProjectName.trim() || !module001ModelFile) {
      setModule001Error("请填写项目名称并选择一个 GLB 文件");
      return;
    }

    const module001AbortController = new AbortController();
    module001AbortRef.current = module001AbortController;
    setModule001Dialog(null);
    module001SetOperation({
      title: "正在新建项目",
      detail: "检查并复制 GLB",
      ratio: 0,
      cancelable: true,
      onCancel: () => module001AbortController.abort(),
    });

    try {
      const module001Created = await module001CreateProjectOnDisk({
        module001WorkspaceHandle,
        module001Workspace,
        module001DisplayName: module001ProjectName,
        module001ModelFile,
        module001Signal: module001AbortController.signal,
        module001OnProgress: ({ stage, ratio }) =>
          module001SetOperation({
            title: "正在新建项目",
            detail:
              stage === "copying" ? "正在复制 GLB" : "正在完成项目文件",
            ratio,
            cancelable: stage !== "complete",
            onCancel: () => module001AbortController.abort(),
          }),
      });
      await module001CommitWorkspace(module001Created.workspace);
      const module001LockController = await module001AcquireProjectLock(
        module001Created.project.projectId,
      );
      module001SetProjectSession({
        module001Project: module001Created.project,
        module001ProjectDirectory: module001Created.projectDirectory,
        module001LockController,
      });
      setModule001ProjectName("");
      setModule001ModelFile(null);
    } catch (module001CreateError) {
      setModule001Error(
        module001CreateError?.name === "AbortError"
          ? "新建项目已取消"
          : module001CreateError instanceof Error
            ? module001CreateError.message
            : "新建项目失败",
      );
    } finally {
      module001AbortRef.current = null;
      module001SetOperation(null);
    }
  }

  /** 复制大型项目并同步新项目摘要。 */
  async function module001CopyProject(module001Summary) {
    setModule001Error(null);
    const module001AbortController = new AbortController();
    module001AbortRef.current = module001AbortController;
    module001SetOperation({
      title: "正在复制项目",
      detail: module001Summary.displayName,
      ratio: 0,
      cancelable: true,
      onCancel: () => module001AbortController.abort(),
    });

    try {
      const module001Copied = await module001CopyProjectOnDisk({
        module001WorkspaceHandle,
        module001Workspace,
        module001Summary,
        module001Signal: module001AbortController.signal,
        module001OnProgress: ({ writtenBytes, totalBytes }) =>
          module001SetOperation({
            title: "正在复制项目",
            detail: module001Summary.displayName,
            ratio: totalBytes > 0 ? writtenBytes / totalBytes : 1,
            cancelable: true,
            onCancel: () => module001AbortController.abort(),
          }),
      });
      await module001CommitWorkspace(module001Copied.workspace);
    } catch (module001CopyError) {
      setModule001Error(
        module001CopyError?.name === "AbortError"
          ? "复制已取消"
          : module001CopyError instanceof Error
            ? module001CopyError.message
            : "复制项目失败",
      );
    } finally {
      module001AbortRef.current = null;
      module001SetOperation(null);
    }
  }

  /** 提交项目显示名称修改。 */
  async function module001RenameProject(module001Event) {
    module001Event.preventDefault();
    const module001Summary = module001Dialog?.summary;

    if (!module001Summary || !module001ProjectName.trim()) {
      return;
    }

    try {
      const module001NextWorkspace = await module001RenameProjectOnDisk({
        module001WorkspaceHandle,
        module001Workspace,
        module001Summary,
        module001DisplayName: module001ProjectName,
      });
      await module001CommitWorkspace(module001NextWorkspace);
      setModule001Dialog(null);
    } catch (module001RenameError) {
      setModule001Error(
        module001RenameError instanceof Error
          ? module001RenameError.message
          : "重命名失败",
      );
    }
  }

  /** 执行逻辑回收或恢复，不删除磁盘目录。 */
  async function module001ToggleTrash(module001Summary, module001Trashed) {
    try {
      const module001NextWorkspace = await module001SetProjectTrashed({
        module001WorkspaceHandle,
        module001Workspace,
        module001ProjectId: module001Summary.projectId,
        module001Trashed,
      });
      await module001CommitWorkspace(module001NextWorkspace);
      setModule001Dialog(null);
    } catch (module001TrashError) {
      setModule001Error(
        module001TrashError instanceof Error
          ? module001TrashError.message
          : "回收站操作失败",
      );
    }
  }

  /** 在名称二次确认后永久删除回收站项目。 */
  async function module001DeletePermanently() {
    const module001Summary = module001Dialog?.summary;

    if (
      !module001Summary ||
      module001DeleteText !== module001Summary.displayName
    ) {
      return;
    }

    try {
      const module001NextWorkspace =
        await module001PermanentlyDeleteProject({
          module001WorkspaceHandle,
          module001Workspace,
          module001Summary,
        });
      await module001CommitWorkspace(module001NextWorkspace);
      setModule001Dialog(null);
      setModule001DeleteText("");
    } catch (module001DeleteError) {
      setModule001Error(
        module001DeleteError instanceof Error
          ? module001DeleteError.message
          : "永久删除失败",
      );
    }
  }

  /** 读取用户选择的 ZIP 并交给模块导入流程。 */
  async function module001HandleZipSelection(module001Event) {
    const module001File = module001Event.target.files?.[0];
    module001Event.target.value = "";

    if (module001File) {
      await module001OnImportProject(module001File);
    }
  }

  return (
    <section className="module001ProjectCenter">
      <header className="module001ProjectCenterHeader">
        <div>
          <span className="module001Eyebrow">本地工作区</span>
          <h1>项目中心</h1>
        </div>
        <div className="module001Toolbar">
          <input
            accept=".zip,application/zip"
            className="module001VisuallyHidden"
            onChange={module001HandleZipSelection}
            ref={module001ZipInputRef}
            type="file"
          />
          <button
            className="module001SecondaryButton"
            onClick={() => module001ZipInputRef.current?.click()}
            type="button"
          >
            <Upload size={16} aria-hidden="true" />
            导入 ZIP
          </button>
          <button
            className="module001PrimaryButton"
            onClick={() => {
              setModule001ProjectName("");
              setModule001ModelFile(null);
              setModule001Dialog({ type: "create" });
            }}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            新建项目
          </button>
        </div>
      </header>

      <div className="module001ProjectTabs" role="tablist" aria-label="项目范围">
        <button
          aria-selected={!module001ShowTrash}
          className={!module001ShowTrash ? "module001ProjectTabActive" : ""}
          onClick={() => setModule001ShowTrash(false)}
          role="tab"
          type="button"
        >
          项目
        </button>
        <button
          aria-selected={module001ShowTrash}
          className={module001ShowTrash ? "module001ProjectTabActive" : ""}
          onClick={() => setModule001ShowTrash(true)}
          role="tab"
          type="button"
        >
          回收站
        </button>
      </div>

      {module001Error ? (
        <div className="module001InlineError" role="alert">
          {module001Error}
        </div>
      ) : null}

      {module001Projects.length === 0 ? (
        <div className="module001EmptyState">
          {module001ShowTrash ? (
            <Trash2 size={26} aria-hidden="true" />
          ) : (
            <Box size={26} aria-hidden="true" />
          )}
          <strong>{module001ShowTrash ? "回收站为空" : "还没有项目"}</strong>
          <span>
            {module001ShowTrash
              ? "删除的项目会先保留在这里"
              : "新建项目并选择一个完整库区 GLB"}
          </span>
        </div>
      ) : (
        <div className="module001ProjectGrid">
          {module001Projects.map((module001Summary) => (
            <article className="module001ProjectCard" key={module001Summary.projectId}>
              <Module001ProjectPreview
                module001Summary={module001Summary}
                module001WorkspaceHandle={module001WorkspaceHandle}
              />
              <div className="module001ProjectCardBody">
                <h2 title={module001Summary.displayName}>
                  {module001Summary.displayName}
                </h2>
                <dl>
                  <div>
                    <dt>更新时间</dt>
                    <dd>{module001FormatDate(module001Summary.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>规模</dt>
                    <dd>
                      {module001Summary.assetCount} 项 ·{" "}
                      {module001FormatBytes(module001Summary.modelFileSize)}
                    </dd>
                  </div>
                  <div>
                    <dt>格式</dt>
                    <dd>V{module001Summary.projectFormatVersion}</dd>
                  </div>
                </dl>
              </div>
              <footer className="module001ProjectCardActions">
                {module001ShowTrash ? (
                  <>
                    <button
                      aria-label={`恢复 ${module001Summary.displayName}`}
                      className="module001SecondaryButton"
                      onClick={() =>
                        module001ToggleTrash(module001Summary, false)
                      }
                      type="button"
                    >
                      <ArchiveRestore size={15} aria-hidden="true" />
                      恢复
                    </button>
                    <button
                      aria-label={`永久删除 ${module001Summary.displayName}`}
                      className="module001DangerButton"
                      onClick={() => {
                        setModule001DeleteText("");
                        setModule001Dialog({
                          type: "delete",
                          summary: module001Summary,
                        });
                      }}
                      type="button"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      永久删除
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="module001PrimaryButton"
                      onClick={() => module001OpenProject(module001Summary)}
                      type="button"
                    >
                      <FolderOpen size={15} aria-hidden="true" />
                      打开
                    </button>
                    <div className="module001ProjectMoreActions">
                      <button
                        aria-label={`重命名 ${module001Summary.displayName}`}
                        className="module001IconButton"
                        onClick={() => {
                          setModule001ProjectName(module001Summary.displayName);
                          setModule001Dialog({
                            type: "rename",
                            summary: module001Summary,
                          });
                        }}
                        title="重命名"
                        type="button"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`复制 ${module001Summary.displayName}`}
                        className="module001IconButton"
                        onClick={() => module001CopyProject(module001Summary)}
                        title="复制"
                        type="button"
                      >
                        <Copy size={15} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`导出 ${module001Summary.displayName}`}
                        className="module001IconButton"
                        onClick={() => module001OnExportProject(module001Summary)}
                        title="导出 ZIP"
                        type="button"
                      >
                        <Download size={15} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`回收 ${module001Summary.displayName}`}
                        className="module001IconButton"
                        onClick={() =>
                          setModule001Dialog({
                            type: "trash",
                            summary: module001Summary,
                          })
                        }
                        title="移入回收站"
                        type="button"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      <Module001Dialog
        module001Description="GLB 将直接复制到你授权的本地工作区，不会上传。"
        module001Open={module001Dialog?.type === "create"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="新建项目"
        module001Children={
          <form
            className="module001Form"
            id="module001CreateProjectForm"
            onSubmit={module001CreateProject}
          >
            <label>
              <span>项目名称</span>
              <input
                autoFocus
                maxLength={80}
                onChange={(module001Event) =>
                  setModule001ProjectName(module001Event.target.value)
                }
                placeholder="例如：一号库区"
                required
                value={module001ProjectName}
              />
            </label>
            <label>
              <span>库区 GLB</span>
              <input
                accept=".glb,model/gltf-binary"
                onChange={(module001Event) =>
                  setModule001ModelFile(module001Event.target.files?.[0] ?? null)
                }
                required
                type="file"
              />
              <small>仅支持自包含 GLB，目标上限 500 MB。</small>
            </label>
          </form>
        }
        module001Footer={
          <>
            <button
              className="module001SecondaryButton"
              onClick={() => setModule001Dialog(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="module001PrimaryButton"
              form="module001CreateProjectForm"
              type="submit"
            >
              <Plus size={15} aria-hidden="true" />
              创建并导入
            </button>
          </>
        }
      />

      <Module001Dialog
        module001Open={module001Dialog?.type === "rename"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="重命名项目"
        module001Children={
          <form
            className="module001Form"
            id="module001RenameProjectForm"
            onSubmit={module001RenameProject}
          >
            <label>
              <span>显示名称</span>
              <input
                autoFocus
                maxLength={80}
                onChange={(module001Event) =>
                  setModule001ProjectName(module001Event.target.value)
                }
                required
                value={module001ProjectName}
              />
              <small>磁盘目录名称不会改变。</small>
            </label>
          </form>
        }
        module001Footer={
          <>
            <button
              className="module001SecondaryButton"
              onClick={() => setModule001Dialog(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="module001PrimaryButton"
              form="module001RenameProjectForm"
              type="submit"
            >
              保存
            </button>
          </>
        }
      />

      <Module001Dialog
        module001Danger
        module001Description={`“${module001Dialog?.summary?.displayName ?? ""}”将进入回收站，项目目录暂时不会删除。`}
        module001Open={module001Dialog?.type === "trash"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="移入回收站"
        module001Children={
          <div className="module001DialogMessage">
            之后可以在回收站恢复，或再次确认永久删除。
          </div>
        }
        module001Footer={
          <>
            <button
              className="module001SecondaryButton"
              onClick={() => setModule001Dialog(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="module001DangerButton"
              onClick={() =>
                module001ToggleTrash(module001Dialog.summary, true)
              }
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
              移入回收站
            </button>
          </>
        }
      />

      <Module001Dialog
        module001Danger
        module001Description="此操作不可撤销，将递归删除该项目的模型、台账和全部配置。"
        module001Open={module001Dialog?.type === "delete"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="永久删除项目"
        module001Children={
          <div className="module001Form">
            <label>
              <span>
                输入项目名称“{module001Dialog?.summary?.displayName}”确认
              </span>
              <input
                autoFocus
                onChange={(module001Event) =>
                  setModule001DeleteText(module001Event.target.value)
                }
                value={module001DeleteText}
              />
            </label>
          </div>
        }
        module001Footer={
          <>
            <button
              className="module001SecondaryButton"
              onClick={() => setModule001Dialog(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="module001DangerButton"
              disabled={
                module001DeleteText !== module001Dialog?.summary?.displayName
              }
              onClick={module001DeletePermanently}
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
              永久删除
            </button>
          </>
        }
      />
    </section>
  );
}
