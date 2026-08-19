import { module002CreateInitialWorkspace } from "../domain/module002Factories";
import {
  module002ParseDraft,
  module002ParseWorkspaceConfig,
} from "../domain/module002Migrations";
import {
  module002ManifestSchema,
  module002WorkspaceConfigSchema,
} from "../domain/module002Schemas";
import {
  module002ReadOptionalText,
  module002SafeWriteJson,
  module002WriteFile,
} from "./module002FileSystem";

const module002ConfigName = "module002-config.json";
const module002ConfigRecoveryName = "module002-config.recovery.json";
const module002DraftName = "module002-current-draft.json";
const module002DraftRecoveryName = "module002-current-draft.recovery.json";
const module002ManifestName = "module002-manifest.json";

/** 在主文件与恢复文件中选择修订号最高的有效版本。 */
async function module002ReadLatestValid({
  module002DirectoryHandle,
  module002Names,
  module002Parse,
}) {
  const module002Candidates = [];
  const module002InvalidNames = [];
  for (const module002Name of module002Names) {
    const module002Text = await module002ReadOptionalText(
      module002DirectoryHandle,
      module002Name,
    );
    if (!module002Text) continue;
    try {
      const module002Raw = JSON.parse(module002Text);
      module002Candidates.push({
        name: module002Name,
        sourceFormatVersion: module002Raw.formatVersion,
        value: module002Parse(module002Text),
      });
    } catch {
      module002InvalidNames.push(module002Name);
    }
  }
  module002Candidates.sort(
    (module002Left, module002Right) =>
      module002Right.value.revision - module002Left.value.revision,
  );
  return {
    candidate: module002Candidates[0] ?? null,
    invalidNames: module002InvalidNames,
  };
}

/** 打开现有模块工作区，或在空目录中写入首版安全结构。 */
export async function module002OpenOrCreateWorkspace(module002DirectoryHandle) {
  const { candidate: module002Loaded, invalidNames: module002InvalidNames } = await module002ReadLatestValid({
    module002DirectoryHandle,
    module002Names: [module002ConfigName, module002ConfigRecoveryName],
    module002Parse: module002ParseWorkspaceConfig,
  });

  if (module002Loaded) {
    const module002WasMigrated =
      module002Loaded.sourceFormatVersion !== module002Loaded.value.formatVersion;
    const module002Config = module002WasMigrated
      ? await module002SaveConfig(
          module002DirectoryHandle,
          module002Loaded.value,
          false,
        )
      : module002Loaded.value;
    return {
      config: module002Config,
      recovered: module002Loaded.name.includes("recovery"),
    };
  }
  if (module002InvalidNames.length) {
    throw new Error("工作区配置已损坏；原文件已保留，请使用恢复副本或配置 ZIP 修复");
  }

  const module002Config = module002CreateInitialWorkspace();
  await module002SaveConfig(module002DirectoryHandle, module002Config, false);
  return { config: module002Config, recovered: false };
}

/** 保存已校验工作区配置并同步 manifest。 */
export async function module002SaveConfig(
  module002DirectoryHandle,
  module002Config,
  module002IncrementRevision = true,
) {
  const module002Now = new Date().toISOString();
  const module002NextConfig = module002WorkspaceConfigSchema.parse({
    ...module002Config,
    revision:
      module002Config.revision + (module002IncrementRevision ? 1 : 0),
    updatedAt: module002Now,
  });
  await module002SafeWriteJson({
    module002DirectoryHandle,
    module002PrimaryName: module002ConfigName,
    module002RecoveryName: module002ConfigRecoveryName,
    module002Value: module002NextConfig,
    module002Validate: module002ParseWorkspaceConfig,
  });
  const module002Manifest = module002ManifestSchema.parse({
    formatVersion: module002NextConfig.formatVersion,
    workspaceId: module002NextConfig.workspaceId,
    createdAt: module002NextConfig.createdAt,
    updatedAt: module002Now,
    compatibleApp: "kunstools-module002",
  });
  await module002WriteFile(
    module002DirectoryHandle,
    module002ManifestName,
    new TextEncoder().encode(`${JSON.stringify(module002Manifest, null, 2)}\n`),
  );
  return module002NextConfig;
}

/** 读取唯一当前草稿；不存在时返回 null。 */
export async function module002LoadCurrentDraft(module002DirectoryHandle) {
  const { candidate: module002Loaded, invalidNames: module002InvalidNames } = await module002ReadLatestValid({
    module002DirectoryHandle,
    module002Names: [module002DraftName, module002DraftRecoveryName],
    module002Parse: module002ParseDraft,
  });
  if (module002Loaded) {
    return {
      draft: module002Loaded.value,
      recovered: module002Loaded.name.includes("recovery"),
    };
  }
  if (module002InvalidNames.length) {
    throw new Error("当前草稿已损坏；原文件已保留，请先修复或另行备份");
  }
  return { draft: null, recovered: false };
}

/** 防抖调用方通过本函数保存当前草稿。 */
export async function module002SaveCurrentDraft(
  module002DirectoryHandle,
  module002Draft,
) {
  const module002NextDraft = {
    ...module002Draft,
    updatedAt: new Date().toISOString(),
  };
  return module002SafeWriteJson({
    module002DirectoryHandle,
    module002PrimaryName: module002DraftName,
    module002RecoveryName: module002DraftRecoveryName,
    module002Value: module002NextDraft,
    module002Validate: module002ParseDraft,
  });
}

/** 明确开始新会议后才移除两份当前草稿文件。 */
export async function module002DeleteCurrentDraft(module002DirectoryHandle) {
  for (const module002Name of [module002DraftName, module002DraftRecoveryName]) {
    await module002DirectoryHandle.removeEntry(module002Name).catch((module002Error) => {
      if (module002Error?.name !== "NotFoundError") throw module002Error;
    });
  }
}

export const module002WorkspaceFileNames = Object.freeze({
  config: module002ConfigName,
  manifest: module002ManifestName,
});
