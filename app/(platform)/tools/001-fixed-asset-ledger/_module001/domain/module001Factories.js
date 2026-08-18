import {
  module001ProjectFormatVersion,
  module001WorkspaceFormatVersion,
} from "./module001Schemas";

const module001ReservedFileNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

/**
 * 创建浏览器和测试环境均可使用的稳定随机编号。
 */
export function module001CreateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `module001-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 将用户项目名转换成安全但仍可辨认的目录或导出文件名。
 */
export function module001SanitizeFileName(module001Name, module001Fallback = "项目") {
  const module001Cleaned = String(module001Name ?? "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  const module001Candidate = module001Cleaned || module001Fallback;

  return module001ReservedFileNames.has(module001Candidate.toLowerCase())
    ? `${module001Candidate}-项目`
    : module001Candidate;
}

/**
 * 建立一个新的工作区清单。
 */
export function module001CreateWorkspace() {
  const module001Now = new Date().toISOString();

  return {
    workspaceFormatVersion: module001WorkspaceFormatVersion,
    workspaceId: module001CreateId(),
    createdAt: module001Now,
    updatedAt: module001Now,
    projects: [],
  };
}

/**
 * 根据 GLB 检查结果建立尚未完成初始化的项目数据。
 */
export function module001CreateProject({
  module001ProjectId,
  module001DisplayName,
  module001ModelFile,
  module001Inspection,
}) {
  const module001Now = new Date().toISOString();
  const module001DefaultCategoryId = module001CreateId();

  return {
    projectFormatVersion: module001ProjectFormatVersion,
    revision: 0,
    projectId: module001ProjectId,
    displayName: module001DisplayName.trim(),
    createdAt: module001Now,
    updatedAt: module001Now,
    initializationStatus: "draft",
    model: {
      fileName: module001ModelFile.name,
      fileSize: module001ModelFile.size,
      importedAt: module001Now,
      sceneCount: module001Inspection.sceneCount,
      topLevelNodeCount: module001Inspection.topLevelNodeCount,
      candidateNodeCount: module001Inspection.candidateNodeCount,
      extensionsUsed: module001Inspection.extensionsUsed,
      extensionsRequired: module001Inspection.extensionsRequired,
    },
    categories: [
      {
        categoryId: module001DefaultCategoryId,
        name: "未分类",
        defaultColor: "#2563eb",
      },
    ],
    customFields: [],
    assets: [],
    modelNodes: module001Inspection.modelNodes,
    sceneSettings: {
      showSceneObjects: true,
      showLabels: true,
    },
    camera: {
      position: [6, 6, 6],
      target: [0, 0, 0],
    },
    coverCamera: null,
    table: {
      columnOrder: ["code", "name", "categoryId", "highlightColor"],
      columnWidths: {
        code: 130,
        name: 180,
        categoryId: 130,
        highlightColor: 120,
      },
      sorting: [],
      columnFilters: [],
      globalFilter: "",
    },
    layout: {
      ledgerPercent: 44,
      ledgerCollapsed: false,
      sceneMaximized: false,
      detailsExpanded: true,
    },
  };
}

/**
 * 创建一项逻辑资产，编号不是内部关系主键。
 */
export function module001CreateAsset({
  module001Code = "",
  module001Name,
  module001CategoryId,
  module001ModelNodeIds,
  module001CustomValues = {},
}) {
  return {
    assetId: module001CreateId(),
    code: module001Code,
    name: module001Name,
    categoryId: module001CategoryId,
    highlightColorOverride: null,
    modelNodeIds: [...module001ModelNodeIds],
    customValues: { ...module001CustomValues },
  };
}

/**
 * 从项目数据生成工作区使用的轻量摘要。
 */
export function module001CreateProjectSummary(
  module001Project,
  module001DirectoryName,
  module001TrashedAt = null,
) {
  return {
    projectId: module001Project.projectId,
    directoryName: module001DirectoryName,
    displayName: module001Project.displayName,
    createdAt: module001Project.createdAt,
    updatedAt: module001Project.updatedAt,
    trashedAt: module001TrashedAt,
    projectFormatVersion: module001Project.projectFormatVersion,
    modelFileSize: module001Project.model.fileSize,
    assetCount: module001Project.assets.length,
  };
}
