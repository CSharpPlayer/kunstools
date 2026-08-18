import {
  module001ProjectFormatVersion,
  module001ProjectSchema,
  module001WorkspaceFormatVersion,
  module001WorkspaceSchema,
} from "./module001Schemas";

/**
 * 将受信任前的项目对象迁移到当前格式；未知新版本会被明确拒绝。
 */
export function module001MigrateProject(module001Input) {
  if (!module001Input || typeof module001Input !== "object") {
    throw new Error("项目数据不是有效对象");
  }

  const module001Version = Number(module001Input.projectFormatVersion);

  if (module001Version > module001ProjectFormatVersion) {
    throw new Error("项目格式来自更新版本，当前程序无法打开");
  }

  if (module001Version !== module001ProjectFormatVersion) {
    throw new Error("项目格式版本无效或缺少迁移路径");
  }

  return module001ProjectSchema.parse(module001Input);
}

/**
 * 解析磁盘项目 JSON，并确保损坏内容不会进入应用状态。
 */
export function module001ParseProjectText(module001Text) {
  let module001Parsed;

  try {
    module001Parsed = JSON.parse(module001Text);
  } catch {
    throw new Error("project.json 已损坏，无法解析");
  }

  return module001MigrateProject(module001Parsed);
}

/**
 * 解析工作区清单，并拒绝未知或损坏的格式。
 */
export function module001ParseWorkspaceText(module001Text) {
  let module001Parsed;

  try {
    module001Parsed = JSON.parse(module001Text);
  } catch {
    throw new Error("workspace.json 已损坏，无法解析");
  }

  if (
    Number(module001Parsed?.workspaceFormatVersion) >
    module001WorkspaceFormatVersion
  ) {
    throw new Error("工作区格式来自更新版本，当前程序无法打开");
  }

  return module001WorkspaceSchema.parse(module001Parsed);
}
