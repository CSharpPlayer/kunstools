import {
  module001CreateId,
  module001CreateProject,
  module001CreateProjectSummary,
  module001SanitizeFileName,
} from "../domain/module001Factories";
import { module001ParseProjectText } from "../domain/module001Migrations";
import {
  module001PackageFormatVersion,
  module001ProjectSchema,
} from "../domain/module001Schemas";
import { module001InspectGlb } from "../import/module001GlbInspector";
import {
  module001CopyFileStream,
  module001ReadTextFile,
  module001RemoveProjectDirectory,
  module001WriteFile,
  module001WriteWorkspace,
} from "./module001FileSystem";

const module001TextEncoder = new TextEncoder();
const module001DefaultPreviewBytes = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
  1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68,
  65, 84, 8, 215, 99, 248, 250, 252, 255, 31, 0, 5, 0, 2, 255, 137, 153,
  221, 212, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

/**
 * 获取工作区内项目的稳定磁盘目录句柄。
 */
export async function module001GetProjectDirectory(
  module001WorkspaceHandle,
  module001DirectoryName,
  module001Create = false,
) {
  const module001ProjectsHandle = await module001WorkspaceHandle.getDirectoryHandle(
    "projects",
    { create: module001Create },
  );
  return module001ProjectsHandle.getDirectoryHandle(module001DirectoryName, {
    create: module001Create,
  });
}

/**
 * 生成项目清单文件，路径全部保持为相对路径。
 */
async function module001BuildManifest(module001Project, module001ProjectDirectory) {
  const module001FileNames = ["project.json", "model.glb", "preview.png"];
  const module001Files = [];

  for (const module001FileName of module001FileNames) {
    const module001FileHandle = await module001ProjectDirectory.getFileHandle(
      module001FileName,
    );
    const module001File = await module001FileHandle.getFile();
    module001Files.push({
      path: module001FileName,
      size: module001File.size,
      required: true,
    });
  }

  try {
    const module001LedgerHandle = await module001ProjectDirectory.getFileHandle(
      "ledger.xlsx",
    );
    const module001Ledger = await module001LedgerHandle.getFile();
    module001Files.push({
      path: "ledger.xlsx",
      size: module001Ledger.size,
      required: false,
    });
  } catch (module001Error) {
    if (module001Error?.name !== "NotFoundError") {
      throw module001Error;
    }
  }

  return {
    packageFormatVersion: module001PackageFormatVersion,
    projectFormatVersion: module001Project.projectFormatVersion,
    projectId: module001Project.projectId,
    displayName: module001Project.displayName,
    createdAt: module001Project.createdAt,
    updatedAt: module001Project.updatedAt,
    files: module001Files,
  };
}

/**
 * 使用恢复文件和主文件完成崩溃安全项目保存。
 */
export async function module001SaveProject(
  module001ProjectDirectory,
  module001Project,
) {
  const module001ValidatedProject = module001ProjectSchema.parse(module001Project);
  const module001ProjectText = `${JSON.stringify(module001ValidatedProject, null, 2)}\n`;
  const module001EncodedProject = module001TextEncoder.encode(module001ProjectText);

  await module001WriteFile(
    module001ProjectDirectory,
    "project.recovery.json",
    module001EncodedProject,
  );
  module001ParseProjectText(
    await module001ReadTextFile(module001ProjectDirectory, "project.recovery.json"),
  );
  await module001WriteFile(
    module001ProjectDirectory,
    "project.json",
    module001EncodedProject,
  );
  module001ParseProjectText(
    await module001ReadTextFile(module001ProjectDirectory, "project.json"),
  );

  const module001Manifest = await module001BuildManifest(
    module001ValidatedProject,
    module001ProjectDirectory,
  );
  await module001WriteFile(
    module001ProjectDirectory,
    "manifest.json",
    module001TextEncoder.encode(`${JSON.stringify(module001Manifest, null, 2)}\n`),
  );

  return module001ValidatedProject;
}

/**
 * 加载主项目和恢复文件，选择通过校验且修订号最高的一代。
 */
export async function module001LoadProject(module001ProjectDirectory) {
  const module001Candidates = [];

  for (const module001FileName of ["project.json", "project.recovery.json"]) {
    try {
      const module001Text = await module001ReadTextFile(
        module001ProjectDirectory,
        module001FileName,
      );
      module001Candidates.push({
        fileName: module001FileName,
        project: module001ParseProjectText(module001Text),
      });
    } catch (module001Error) {
      if (module001Error?.name === "NotFoundError") {
        continue;
      }
    }
  }

  if (module001Candidates.length === 0) {
    throw new Error("项目主文件和恢复文件均无效");
  }

  module001Candidates.sort(
    (module001Left, module001Right) =>
      module001Right.project.revision - module001Left.project.revision,
  );

  return {
    project: module001Candidates[0].project,
    recovered: module001Candidates[0].fileName === "project.recovery.json",
  };
}

/**
 * 检查并创建一个新项目，登记前发生失败会清理半成品目录。
 */
export async function module001CreateProjectOnDisk({
  module001WorkspaceHandle,
  module001Workspace,
  module001DisplayName,
  module001ModelFile,
  module001Signal,
  module001OnProgress,
}) {
  const module001Inspection = await module001InspectGlb(module001ModelFile);
  const module001ProjectId = module001CreateId();
  const module001ShortId = module001ProjectId.replaceAll("-", "").slice(0, 8);
  const module001DirectoryName = `${module001SanitizeFileName(
    module001DisplayName,
  )}-${module001ShortId}`;
  const module001ProjectDirectory = await module001GetProjectDirectory(
    module001WorkspaceHandle,
    module001DirectoryName,
    true,
  );

  try {
    module001OnProgress?.({ stage: "copying", ratio: 0 });
    await module001CopyFileStream({
      module001SourceFile: module001ModelFile,
      module001TargetDirectory: module001ProjectDirectory,
      module001TargetName: "model.glb",
      module001Signal,
      module001OnProgress: ({ writtenBytes, totalBytes }) =>
        module001OnProgress?.({
          stage: "copying",
          ratio: totalBytes > 0 ? writtenBytes / totalBytes : 1,
        }),
    });
    await module001WriteFile(
      module001ProjectDirectory,
      "preview.png",
      module001DefaultPreviewBytes,
    );

    const module001Project = module001CreateProject({
      module001ProjectId,
      module001DisplayName,
      module001ModelFile,
      module001Inspection,
    });
    await module001SaveProject(module001ProjectDirectory, module001Project);

    const module001NextWorkspace = await module001WriteWorkspace(
      module001WorkspaceHandle,
      {
        ...module001Workspace,
        projects: [
          ...module001Workspace.projects,
          module001CreateProjectSummary(
            module001Project,
            module001DirectoryName,
          ),
        ],
      },
    );

    module001OnProgress?.({ stage: "complete", ratio: 1 });
    return {
      workspace: module001NextWorkspace,
      project: module001Project,
      projectDirectory: module001ProjectDirectory,
      inspection: module001Inspection,
    };
  } catch (module001Error) {
    await module001RemoveProjectDirectory(
      module001WorkspaceHandle,
      module001DirectoryName,
    ).catch(() => {});
    throw module001Error;
  }
}

/**
 * 打开工作区摘要对应的项目目录和已校验项目数据。
 */
export async function module001OpenProjectFromSummary(
  module001WorkspaceHandle,
  module001Summary,
) {
  const module001ProjectDirectory = await module001GetProjectDirectory(
    module001WorkspaceHandle,
    module001Summary.directoryName,
  );
  const module001Loaded = await module001LoadProject(module001ProjectDirectory);

  return {
    ...module001Loaded,
    projectDirectory: module001ProjectDirectory,
  };
}

/**
 * 重命名只更新显示名称和清单，不改变稳定磁盘目录。
 */
export async function module001RenameProjectOnDisk({
  module001WorkspaceHandle,
  module001Workspace,
  module001Summary,
  module001DisplayName,
}) {
  const module001Opened = await module001OpenProjectFromSummary(
    module001WorkspaceHandle,
    module001Summary,
  );
  const module001Now = new Date().toISOString();
  const module001NextProject = {
    ...module001Opened.project,
    displayName: module001DisplayName.trim(),
    updatedAt: module001Now,
    revision: module001Opened.project.revision + 1,
  };

  await module001SaveProject(
    module001Opened.projectDirectory,
    module001NextProject,
  );
  const module001NextProjects = module001Workspace.projects.map(
    (module001ProjectSummary) =>
      module001ProjectSummary.projectId === module001Summary.projectId
        ? {
            ...module001ProjectSummary,
            displayName: module001NextProject.displayName,
            updatedAt: module001Now,
          }
        : module001ProjectSummary,
  );

  return module001WriteWorkspace(module001WorkspaceHandle, {
    ...module001Workspace,
    projects: module001NextProjects,
  });
}

/**
 * 复制项目数据和模型到独立目录，并生成新的 projectId。
 */
export async function module001CopyProjectOnDisk({
  module001WorkspaceHandle,
  module001Workspace,
  module001Summary,
  module001Signal,
  module001OnProgress,
}) {
  const module001Source = await module001OpenProjectFromSummary(
    module001WorkspaceHandle,
    module001Summary,
  );
  const module001SourceModelHandle =
    await module001Source.projectDirectory.getFileHandle("model.glb");
  const module001SourceModel = await module001SourceModelHandle.getFile();
  const module001CopyId = module001CreateId();
  const module001Now = new Date().toISOString();
  const module001CopyName = `${module001Source.project.displayName} - 副本`;
  const module001DirectoryName = `${module001SanitizeFileName(
    module001CopyName,
  )}-${module001CopyId.replaceAll("-", "").slice(0, 8)}`;
  const module001TargetDirectory = await module001GetProjectDirectory(
    module001WorkspaceHandle,
    module001DirectoryName,
    true,
  );

  try {
    await module001CopyFileStream({
      module001SourceFile: module001SourceModel,
      module001TargetDirectory,
      module001TargetName: "model.glb",
      module001Signal,
      module001OnProgress,
    });

    try {
      const module001PreviewHandle =
        await module001Source.projectDirectory.getFileHandle("preview.png");
      await module001CopyFileStream({
        module001SourceFile: await module001PreviewHandle.getFile(),
        module001TargetDirectory,
        module001TargetName: "preview.png",
        module001Signal,
      });
    } catch {
      await module001WriteFile(
        module001TargetDirectory,
        "preview.png",
        module001DefaultPreviewBytes,
      );
    }

    const module001CopyProject = module001ProjectSchema.parse({
      ...structuredClone(module001Source.project),
      projectId: module001CopyId,
      displayName: module001CopyName,
      createdAt: module001Now,
      updatedAt: module001Now,
      revision: 0,
    });
    await module001SaveProject(module001TargetDirectory, module001CopyProject);
    const module001NextWorkspace = await module001WriteWorkspace(
      module001WorkspaceHandle,
      {
        ...module001Workspace,
        projects: [
          ...module001Workspace.projects,
          module001CreateProjectSummary(
            module001CopyProject,
            module001DirectoryName,
          ),
        ],
      },
    );

    return { workspace: module001NextWorkspace, project: module001CopyProject };
  } catch (module001Error) {
    await module001RemoveProjectDirectory(
      module001WorkspaceHandle,
      module001DirectoryName,
    ).catch(() => {});
    throw module001Error;
  }
}

/**
 * 将项目放入或移出逻辑回收站，不删除磁盘目录。
 */
export async function module001SetProjectTrashed({
  module001WorkspaceHandle,
  module001Workspace,
  module001ProjectId,
  module001Trashed,
}) {
  const module001Now = new Date().toISOString();
  const module001Projects = module001Workspace.projects.map(
    (module001Summary) =>
      module001Summary.projectId === module001ProjectId
        ? {
            ...module001Summary,
            trashedAt: module001Trashed ? module001Now : null,
            updatedAt: module001Now,
          }
        : module001Summary,
  );

  return module001WriteWorkspace(module001WorkspaceHandle, {
    ...module001Workspace,
    projects: module001Projects,
  });
}

/**
 * 永久删除已经进入回收站的指定项目目录和清单记录。
 */
export async function module001PermanentlyDeleteProject({
  module001WorkspaceHandle,
  module001Workspace,
  module001Summary,
}) {
  if (!module001Summary.trashedAt) {
    throw new Error("项目必须先进入回收站才能永久删除");
  }

  await module001RemoveProjectDirectory(
    module001WorkspaceHandle,
    module001Summary.directoryName,
  );

  return module001WriteWorkspace(module001WorkspaceHandle, {
    ...module001Workspace,
    projects: module001Workspace.projects.filter(
      (module001Project) =>
        module001Project.projectId !== module001Summary.projectId,
    ),
  });
}
