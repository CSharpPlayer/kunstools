import {
  module001CreateId,
  module001CreateProjectSummary,
  module001SanitizeFileName,
} from "../domain/module001Factories";
import { module001ParseProjectText } from "../domain/module001Migrations";
import {
  module001ProjectManifestSchema,
  module001ProjectSchema,
} from "../domain/module001Schemas";
import { module001InspectGlb } from "../import/module001GlbInspector";
import {
  module001CreateWritable,
  module001RemoveProjectDirectory,
  module001WriteWorkspace,
} from "../workspace/module001FileSystem";
import {
  module001GetProjectDirectory,
  module001SaveProject,
} from "../workspace/module001ProjectRepository";
import { module001ExportLedgerXlsx } from "./module001Xlsx";

const module001RequiredPackageFiles = new Set([
  "manifest.json",
  "project.json",
  "model.glb",
  "ledger.xlsx",
  "preview.png",
]);
const module001MaximumPackageBytes = 1200 * 1024 * 1024;
const module001MaximumNonModelBytes = 64 * 1024 * 1024;

/**
 * 检查 ZIP 条目路径是否严格位于项目包根目录。
 */
function module001IsSafePackagePath(module001Path) {
  return (
    module001RequiredPackageFiles.has(module001Path) &&
    !module001Path.includes("/") &&
    !module001Path.includes("\\") &&
    !module001Path.includes("..") &&
    !/^[a-zA-Z]:/.test(module001Path)
  );
}

/**
 * 由用户点击动作选择 ZIP 输出位置。
 */
export async function module001ChooseZipSaveHandle(module001ProjectName) {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error("当前浏览器不支持选择 ZIP 保存位置");
  }

  const module001Timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", "-")
    .slice(0, 19);

  return window.showSaveFilePicker({
    id: "kunstools-module001-zip",
    suggestedName: `${module001SanitizeFileName(
      module001ProjectName,
    )}-${module001Timestamp}.zip`,
    types: [
      {
        description: "标准项目 ZIP",
        accept: { "application/zip": [".zip"] },
      },
    ],
  });
}

/**
 * 生成包含最新台账、模型、封面和版本清单的流式项目 ZIP。
 */
export async function module001ExportProjectZip({
  module001Project,
  module001ProjectDirectory,
  module001SaveHandle,
  module001Signal,
  module001OnProgress,
}) {
  await module001ExportLedgerXlsx({
    module001Project,
    module001ProjectDirectory,
    module001Assets: module001Project.assets,
  });
  await module001SaveProject(module001ProjectDirectory, module001Project);

  const { ZipWriter: Module001ZipWriter } = await import("@zip.js/zip.js");
  const module001Writable = await module001CreateWritable(module001SaveHandle);
  const module001ZipWriter = new Module001ZipWriter(module001Writable, {
    zip64: true,
  });
  const module001FileNames = [
    "manifest.json",
    "project.json",
    "model.glb",
    "ledger.xlsx",
    "preview.png",
  ];
  const module001Files = [];

  for (const module001FileName of module001FileNames) {
    const module001Handle = await module001ProjectDirectory.getFileHandle(
      module001FileName,
    );
    module001Files.push({
      name: module001FileName,
      file: await module001Handle.getFile(),
    });
  }

  const module001TotalBytes = module001Files.reduce(
    (module001Total, module001Entry) => module001Total + module001Entry.file.size,
    0,
  );
  let module001CompletedBytes = 0;

  try {
    for (const module001Entry of module001Files) {
      await module001ZipWriter.add(
        module001Entry.name,
        module001Entry.file.stream(),
        {
          level: module001Entry.name === "model.glb" ? 0 : 6,
          signal: module001Signal,
          onprogress: (module001Index, module001Max) => {
            module001OnProgress?.({
              fileName: module001Entry.name,
              ratio:
                module001TotalBytes > 0
                  ? (module001CompletedBytes +
                      Math.min(module001Index, module001Max)) /
                    module001TotalBytes
                  : 1,
            });
          },
        },
      );
      module001CompletedBytes += module001Entry.file.size;
    }

    await module001ZipWriter.close();
    module001OnProgress?.({ fileName: "complete", ratio: 1 });
  } catch (module001Error) {
    await module001Writable.abort(module001Error).catch(() => {});
    throw module001Error;
  }
}

/**
 * 只读检查 ZIP 清单、项目 schema、路径、大小、加密和压缩比例。
 */
export async function module001InspectProjectZip(module001ZipFile) {
  if (!module001ZipFile?.name.toLowerCase().endsWith(".zip")) {
    throw new Error("请选择标准 .zip 项目包");
  }

  const {
    BlobReader: Module001BlobReader,
    TextWriter: Module001TextWriter,
    ZipReader: Module001ZipReader,
  } = await import("@zip.js/zip.js");
  const module001Reader = new Module001ZipReader(
    new Module001BlobReader(module001ZipFile),
    {
      checkSignature: true,
      preventOverlappingEntries: true,
    },
  );

  try {
    const module001Entries = (await module001Reader.getEntries()).filter(
      (module001Entry) => !module001Entry.directory,
    );

    if (module001Entries.length > 20) {
      throw new Error("ZIP 条目数量超出项目包限制");
    }

    const module001Names = new Set();
    let module001TotalBytes = 0;

    for (const module001Entry of module001Entries) {
      if (!module001IsSafePackagePath(module001Entry.filename)) {
        throw new Error(`ZIP 包含不允许的路径：${module001Entry.filename}`);
      }
      if (module001Names.has(module001Entry.filename)) {
        throw new Error(`ZIP 存在重复条目：${module001Entry.filename}`);
      }
      if (module001Entry.encrypted) {
        throw new Error("不支持加密 ZIP 项目包");
      }

      const module001UncompressedSize = module001Entry.uncompressedSize ?? 0;
      const module001CompressedSize = module001Entry.compressedSize ?? 0;
      const module001Limit =
        module001Entry.filename === "model.glb"
          ? 500 * 1024 * 1024
          : module001MaximumNonModelBytes;

      if (module001UncompressedSize > module001Limit) {
        throw new Error(`${module001Entry.filename} 超出允许大小`);
      }
      if (
        module001CompressedSize > 0 &&
        module001UncompressedSize > 5 * 1024 * 1024 &&
        module001UncompressedSize / module001CompressedSize > 250
      ) {
        throw new Error(`${module001Entry.filename} 压缩比例异常`);
      }

      module001Names.add(module001Entry.filename);
      module001TotalBytes += module001UncompressedSize;
    }

    if (module001TotalBytes > module001MaximumPackageBytes) {
      throw new Error("ZIP 解压后总大小超出项目包限制");
    }

    for (const module001RequiredFile of module001RequiredPackageFiles) {
      if (!module001Names.has(module001RequiredFile)) {
        throw new Error(`ZIP 缺少必需文件：${module001RequiredFile}`);
      }
    }

    const module001EntryMap = new Map(
      module001Entries.map((module001Entry) => [
        module001Entry.filename,
        module001Entry,
      ]),
    );
    const module001ManifestText = await module001EntryMap
      .get("manifest.json")
      .getData(new Module001TextWriter());
    const module001ProjectText = await module001EntryMap
      .get("project.json")
      .getData(new Module001TextWriter());
    let module001ManifestJson;

    try {
      module001ManifestJson = JSON.parse(module001ManifestText);
    } catch {
      throw new Error("ZIP 中的 manifest.json 已损坏");
    }

    const module001Manifest = module001ProjectManifestSchema.parse(
      module001ManifestJson,
    );
    const module001Project = module001ParseProjectText(module001ProjectText);
    const module001ManifestPaths = module001Manifest.files.map(
      (module001File) => module001File.path,
    );

    if (
      new Set(module001ManifestPaths).size !== module001ManifestPaths.length
    ) {
      throw new Error("ZIP 清单包含重复文件记录");
    }
    for (const module001ExpectedPath of [
      "project.json",
      "model.glb",
      "ledger.xlsx",
      "preview.png",
    ]) {
      if (!module001ManifestPaths.includes(module001ExpectedPath)) {
        throw new Error(`ZIP 清单缺少文件记录：${module001ExpectedPath}`);
      }
    }

    if (module001Manifest.projectId !== module001Project.projectId) {
      throw new Error("ZIP 清单与项目内部编号不一致");
    }
    if (
      module001EntryMap.get("model.glb").uncompressedSize !==
      module001Project.model.fileSize
    ) {
      throw new Error("ZIP 模型大小与 project.json 记录不一致");
    }

    module001Manifest.files.forEach((module001File) => {
      const module001Entry = module001EntryMap.get(module001File.path);
      if (!module001Entry || module001Entry.uncompressedSize !== module001File.size) {
        throw new Error(`ZIP 清单文件大小不一致：${module001File.path}`);
      }
    });

    return {
      project: module001Project,
      manifest: module001Manifest,
      totalBytes: module001TotalBytes,
      fileName: module001ZipFile.name,
    };
  } finally {
    await module001Reader.close();
  }
}

/**
 * 把已检查 ZIP 写入未登记目录，完整校验后才更新工作区清单。
 */
export async function module001ImportProjectZip({
  module001ZipFile,
  module001Inspection,
  module001WorkspaceHandle,
  module001Workspace,
  module001ConflictStrategy = "copy",
  module001Signal,
  module001OnProgress,
}) {
  const module001ExistingSummary = module001Workspace.projects.find(
    (module001Summary) =>
      module001Summary.projectId === module001Inspection.project.projectId,
  );

  if (
    module001ExistingSummary &&
    !["copy", "overwrite"].includes(module001ConflictStrategy)
  ) {
    throw new Error("请选择覆盖现有项目或另存为副本");
  }

  const module001NewProjectId =
    module001ExistingSummary && module001ConflictStrategy === "copy"
      ? module001CreateId()
      : module001Inspection.project.projectId;
  const module001DisplayName =
    module001ExistingSummary && module001ConflictStrategy === "copy"
      ? `${module001Inspection.project.displayName} - 导入副本`
      : module001Inspection.project.displayName;
  const module001DirectoryName = `${module001SanitizeFileName(
    module001DisplayName,
  )}-${module001CreateId().replaceAll("-", "").slice(0, 8)}`;
  const module001TargetDirectory = await module001GetProjectDirectory(
    module001WorkspaceHandle,
    module001DirectoryName,
    true,
  );
  const {
    BlobReader: Module001BlobReader,
    ZipReader: Module001ZipReader,
  } = await import("@zip.js/zip.js");
  const module001Reader = new Module001ZipReader(
    new Module001BlobReader(module001ZipFile),
    {
      checkSignature: true,
      preventOverlappingEntries: true,
    },
  );

  try {
    const module001Entries = (await module001Reader.getEntries()).filter(
      (module001Entry) => !module001Entry.directory,
    );
    let module001CompletedBytes = 0;

    for (const module001Entry of module001Entries) {
      const module001FileHandle = await module001TargetDirectory.getFileHandle(
        module001Entry.filename,
        { create: true },
      );
      const module001Writable = await module001CreateWritable(
        module001FileHandle,
      );

      await module001Entry.getData(module001Writable, {
        signal: module001Signal,
        checkSignature: true,
        onprogress: (module001Index, module001Max) =>
          module001OnProgress?.({
            fileName: module001Entry.filename,
            ratio:
              module001Inspection.totalBytes > 0
                ? (module001CompletedBytes +
                    Math.min(module001Index, module001Max)) /
                  module001Inspection.totalBytes
                : 1,
          }),
      });
      module001CompletedBytes += module001Entry.uncompressedSize;
    }

    const module001ModelHandle = await module001TargetDirectory.getFileHandle(
      "model.glb",
    );
    const module001ModelFile = await module001ModelHandle.getFile();
    const module001GlbInspection = await module001InspectGlb(module001ModelFile);
    const module001ImportedProject = module001ProjectSchema.parse({
      ...structuredClone(module001Inspection.project),
      projectId: module001NewProjectId,
      displayName: module001DisplayName,
      updatedAt: new Date().toISOString(),
      revision: module001Inspection.project.revision + 1,
    });

    if (
      module001ImportedProject.model.topLevelNodeCount !==
        module001GlbInspection.topLevelNodeCount ||
      module001ImportedProject.model.candidateNodeCount !==
        module001GlbInspection.candidateNodeCount
    ) {
      throw new Error("导入项目的模型统计与 GLB 顶层结构不一致");
    }

    for (const module001Node of module001ImportedProject.modelNodes) {
      const module001InspectedNode =
        module001GlbInspection.modelNodes[module001Node.sceneNodeOrdinal];
      if (
        !module001InspectedNode ||
        module001Node.topLevelIndex !== module001InspectedNode.topLevelIndex ||
        module001Node.isCandidate !== module001InspectedNode.isCandidate ||
        module001Node.meshDescendantCount !==
          module001InspectedNode.meshDescendantCount
      ) {
        throw new Error("导入项目的模型节点映射与 GLB 不一致");
      }
    }

    await module001SaveProject(
      module001TargetDirectory,
      module001ImportedProject,
    );
    const module001NextSummary = module001CreateProjectSummary(
      module001ImportedProject,
      module001DirectoryName,
    );
    let module001NextProjects;

    if (module001ExistingSummary && module001ConflictStrategy === "overwrite") {
      module001NextProjects = module001Workspace.projects.map(
        (module001Summary) =>
          module001Summary.projectId === module001ExistingSummary.projectId
            ? module001NextSummary
            : module001Summary,
      );
    } else {
      module001NextProjects = [
        ...module001Workspace.projects,
        module001NextSummary,
      ];
    }

    const module001NextWorkspace = await module001WriteWorkspace(
      module001WorkspaceHandle,
      {
        ...module001Workspace,
        projects: module001NextProjects,
      },
    );

    if (module001ExistingSummary && module001ConflictStrategy === "overwrite") {
      await module001RemoveProjectDirectory(
        module001WorkspaceHandle,
        module001ExistingSummary.directoryName,
      ).catch(() => {});
    }

    module001OnProgress?.({ fileName: "complete", ratio: 1 });
    return {
      workspace: module001NextWorkspace,
      project: module001ImportedProject,
      projectDirectory: module001TargetDirectory,
    };
  } catch (module001Error) {
    await module001RemoveProjectDirectory(
      module001WorkspaceHandle,
      module001DirectoryName,
    ).catch(() => {});
    throw module001Error;
  } finally {
    await module001Reader.close();
  }
}
