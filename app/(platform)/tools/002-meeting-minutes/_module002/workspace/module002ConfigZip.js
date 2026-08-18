import { module002ParseWorkspaceConfig } from "../domain/module002Migrations";
import { module002WorkspaceConfigSchema } from "../domain/module002Schemas";

const module002ZipManifestName = "manifest.json";
const module002ZipConfigName = "configuration.json";
const module002AllowedZipNames = new Set([
  module002ZipManifestName,
  module002ZipConfigName,
]);

/** 生成不含 API Key、草稿、原文件和输出的配置迁移 ZIP。 */
export async function module002CreateConfigZip(module002Config) {
  const {
    BlobWriter: Module002BlobWriter,
    TextReader: Module002TextReader,
    ZipWriter: Module002ZipWriter,
  } = await import("@zip.js/zip.js");
  const module002Writer = new Module002ZipWriter(
    new Module002BlobWriter("application/zip"),
  );
  const module002Manifest = {
    package: "kunstools-module002-configuration",
    formatVersion: module002Config.formatVersion,
    exportedAt: new Date().toISOString(),
    workspaceId: module002Config.workspaceId,
  };
  await module002Writer.add(
    module002ZipManifestName,
    new Module002TextReader(`${JSON.stringify(module002Manifest, null, 2)}\n`),
  );
  await module002Writer.add(
    module002ZipConfigName,
    new Module002TextReader(`${JSON.stringify(module002Config, null, 2)}\n`),
  );
  return module002Writer.close();
}

/** 严格检查配置 ZIP 路径、类型、大小和 schema。 */
export async function module002InspectConfigZip(module002File) {
  if (!module002File?.name.toLowerCase().endsWith(".zip")) {
    throw new Error("请选择 .zip 配置迁移包");
  }
  if (module002File.size > 20 * 1024 * 1024) {
    throw new Error("配置 ZIP 超出 20MB 安全限制");
  }
  const {
    BlobReader: Module002BlobReader,
    TextWriter: Module002TextWriter,
    ZipReader: Module002ZipReader,
  } = await import("@zip.js/zip.js");
  const module002Reader = new Module002ZipReader(new Module002BlobReader(module002File), {
    checkSignature: true,
    preventOverlappingEntries: true,
  });
  try {
    const module002Entries = (await module002Reader.getEntries()).filter(
      (module002Entry) => !module002Entry.directory,
    );
    if (module002Entries.length !== 2) throw new Error("配置 ZIP 文件数量不正确");
    for (const module002Entry of module002Entries) {
      if (
        !module002AllowedZipNames.has(module002Entry.filename) ||
        module002Entry.filename.includes("..") ||
        module002Entry.filename.includes("/") ||
        module002Entry.filename.includes("\\") ||
        module002Entry.encrypted ||
        (module002Entry.uncompressedSize ?? 0) > 10 * 1024 * 1024
      ) {
        throw new Error(`ZIP 包含不允许的条目：${module002Entry.filename}`);
      }
    }
    const module002Map = new Map(
      module002Entries.map((module002Entry) => [module002Entry.filename, module002Entry]),
    );
    const module002Manifest = JSON.parse(
      await module002Map.get(module002ZipManifestName).getData(new Module002TextWriter()),
    );
    if (module002Manifest.package !== "kunstools-module002-configuration") {
      throw new Error("不是模块 002 配置迁移包");
    }
    const module002Config = module002ParseWorkspaceConfig(
      await module002Map
        .get(module002ZipConfigName)
        .getData(new Module002TextWriter()),
    );
    return { manifest: module002Manifest, config: module002Config };
  } finally {
    await module002Reader.close();
  }
}

/** 列出同 ID 或同名的配置冲突，默认决策为保留本机。 */
export function module002BuildConfigConflicts(module002Local, module002Imported) {
  const module002Conflicts = [];
  for (const module002EntityName of ["templates", "people"]) {
    module002Imported[module002EntityName].forEach((module002ImportedItem) => {
      const module002LocalItem = module002Local[module002EntityName].find(
        (module002Item) =>
          module002Item.id === module002ImportedItem.id ||
          module002Item.name === module002ImportedItem.name,
      );
      if (module002LocalItem) {
        module002Conflicts.push({
          key: `${module002EntityName}:${module002ImportedItem.id}`,
          entity: module002EntityName,
          local: module002LocalItem,
          imported: module002ImportedItem,
          decision: "keepLocal",
        });
      }
    });
  }
  return module002Conflicts;
}

/**
 * 按预览勾选和逐项冲突决策合并配置；失败时调用方仍持有完整本机原值。
 */
export function module002MergeImportedConfig({
  module002Local,
  module002Imported,
  module002Selection,
  module002Decisions = {},
}) {
  const module002Next = structuredClone(module002Local);
  const module002BranchMap = new Map(
    module002Imported.branches.map((module002ImportedBranch) => {
      const module002LocalBranch = module002Local.branches.find(
        (module002Branch) => module002Branch.name === module002ImportedBranch.name,
      );
      return [module002ImportedBranch.id, module002LocalBranch?.id];
    }),
  );

  /** 合并模板或人物实体，并对另存副本生成全新稳定 ID。 */
  function module002MergeEntities(module002EntityName) {
    module002Imported[module002EntityName].forEach((module002ImportedItem) => {
      const module002MappedBranchId = module002BranchMap.get(
        module002ImportedItem.branchId,
      );
      if (!module002MappedBranchId) return;
      const module002Prepared = {
        ...structuredClone(module002ImportedItem),
        branchId: module002MappedBranchId,
      };
      const module002ConflictIndex = module002Next[module002EntityName].findIndex(
        (module002LocalItem) =>
          module002LocalItem.id === module002Prepared.id ||
          (module002LocalItem.branchId === module002MappedBranchId &&
            module002LocalItem.name === module002Prepared.name),
      );
      if (module002ConflictIndex < 0) {
        module002Next[module002EntityName].push(module002Prepared);
        return;
      }
      const module002Decision =
        module002Decisions[`${module002EntityName}:${module002ImportedItem.id}`] ??
        "keepLocal";
      if (module002Decision === "useImported") {
        module002Prepared.id =
          module002Next[module002EntityName][module002ConflictIndex].id;
        module002Next[module002EntityName][module002ConflictIndex] = module002Prepared;
      } else if (module002Decision === "copy") {
        module002Prepared.id = crypto.randomUUID();
        module002Prepared.name = `${module002Prepared.name} - 导入副本`;
        if (module002EntityName === "templates") {
          module002Prepared.modules = module002Prepared.modules.map(
            (module002Module) => ({ ...module002Module, id: crypto.randomUUID() }),
          );
        }
        module002Next[module002EntityName].push(module002Prepared);
      }
    });
  }

  if (module002Selection.templates) module002MergeEntities("templates");
  if (module002Selection.people) module002MergeEntities("people");
  if (module002Selection.personFields) {
    module002Next.personFields = structuredClone(module002Imported.personFields);
  }
  if (module002Selection.documentFormat) {
    module002Next.documentFormat = structuredClone(module002Imported.documentFormat);
  }
  if (module002Selection.settings) {
    module002Next.settings = structuredClone(module002Imported.settings);
  }
  if (module002Selection.prompts && !module002Selection.templates) {
    module002Imported.templates.forEach((module002ImportedTemplate) => {
      const module002MappedBranchId = module002BranchMap.get(
        module002ImportedTemplate.branchId,
      );
      const module002LocalTemplate = module002Next.templates.find(
        (module002Template) =>
          module002Template.branchId === module002MappedBranchId &&
          module002Template.name === module002ImportedTemplate.name,
      );
      if (module002LocalTemplate) {
        module002LocalTemplate.defaultPrompt = module002ImportedTemplate.defaultPrompt;
      }
    });
  }
  module002Next.revision += 1;
  module002Next.updatedAt = new Date().toISOString();
  return module002WorkspaceConfigSchema.parse(module002Next);
}
