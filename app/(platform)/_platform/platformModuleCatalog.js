import { ClipboardList, FilePenLine } from "lucide-react";

export const platformHomeEntry = Object.freeze({
  id: "home",
  name: "主页",
  path: "/",
});

export const platformModuleList = Object.freeze([
  Object.freeze({
    id: "001",
    name: "001 可视化固定资产管理台账",
    workspaceFolderName: "001 可视化固定资产管理台账",
    path: "/tools/001-fixed-asset-ledger",
    icon: ClipboardList,
    status: "pending",
  }),
  Object.freeze({
    id: "002",
    name: "002 党建会议记录辅助生成工具",
    workspaceFolderName: "002 党建会议记录辅助生成工具",
    path: "/tools/002-meeting-minutes",
    icon: FilePenLine,
    status: "active",
  }),
]);

export const platformKnownEntries = Object.freeze([
  platformHomeEntry,
  ...platformModuleList,
]);

/**
 * 根据当前网址查找主页或已登记模块。
 */
export function platformFindEntryByPath(platformPathname) {
  return platformKnownEntries.find(
    (platformEntry) => platformEntry.path === platformPathname,
  );
}

/**
 * 根据标签编号查找主页或已登记模块。
 */
export function platformFindEntryById(platformEntryId) {
  return platformKnownEntries.find(
    (platformEntry) => platformEntry.id === platformEntryId,
  );
}

/**
 * 取得模块在平台共享根目录中的稳定存储文件夹名。
 */
export function platformGetModuleWorkspaceFolderName(platformModuleId) {
  return platformFindEntryById(platformModuleId)?.workspaceFolderName ?? null;
}
