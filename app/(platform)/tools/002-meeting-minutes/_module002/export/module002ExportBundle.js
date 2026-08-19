import { module002FormatChineseDate } from "../domain/module002Document";
import { module002BuildNoticeContent } from "../domain/module002Notice";
import { module002BuildAttendanceContent, module002BuildAttendanceXlsx } from "./module002TemplateXlsx";
import { module002BuildNoticeDocx } from "./module002TemplateDocx";
import { module002LoadTemplateFile, module002TemplateKinds } from "./module002TemplateAssets";
import { module002BuildDocx, module002CreateDraftFingerprint } from "./module002Docx";

/** 将用户填写的会议名称转换为本地文件系统安全的文件名片段。 */
function module002SanitizeExportFileName(module002Value) {
  return String(module002Value || "会议记录")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim() || "会议记录";
}

/** 按用户确认的“日期-会议名称”规则生成同目录导出文件名。 */
export function module002CreateExportFileNames(module002Draft) {
  const module002Date = module002FormatChineseDate(module002Draft.meetingInfo.date)
    .replace(/[年月]/g, "-")
    .replace("日", "");
  const module002MeetingName = module002SanitizeExportFileName(
    module002Draft.meetingInfo.meetingName,
  );
  const module002Prefix = `${module002Date}-${module002MeetingName}`;
  return {
    record: `${module002Prefix}.docx`,
    notice: `${module002Prefix}-通知.docx`,
    attendance: `${module002Prefix}-签到簿.xlsx`,
  };
}

/** 根据本次勾选内容预先生成全部文件，避免选择目录后才发现模板错误。 */
export async function module002BuildExportFiles({
  module002Draft,
  module002Config,
  module002WorkspaceHandle,
  module002Options,
}) {
  const module002FileNames = module002CreateExportFileNames(module002Draft);
  const module002Files = [{
    name: module002FileNames.record,
    blob: await module002BuildDocx(module002Draft, module002Config),
  }];
  if (module002Options.notice) {
    const module002NoticeTemplate = await module002LoadTemplateFile(
      module002WorkspaceHandle,
      module002Config.exportTemplates.notice,
      module002TemplateKinds.notice,
    );
    module002Files.push({
      name: module002FileNames.notice,
      blob: await module002BuildNoticeDocx({
        module002TemplateFile: module002NoticeTemplate,
        module002Mapping: module002Config.exportTemplates.notice.mapping,
        module002Content: module002BuildNoticeContent(module002Draft, module002Config),
      }),
    });
  }
  if (module002Options.attendance) {
    const module002AttendanceTemplate = await module002LoadTemplateFile(
      module002WorkspaceHandle,
      module002Config.exportTemplates.attendance,
      module002TemplateKinds.attendance,
    );
    module002Files.push({
      name: module002FileNames.attendance,
      blob: await module002BuildAttendanceXlsx({
        module002TemplateFile: module002AttendanceTemplate,
        module002Mapping: module002Config.exportTemplates.attendance.mapping,
        module002Content: module002BuildAttendanceContent(module002Draft, module002Config),
      }),
    });
  }
  return module002Files;
}

/** 查找导出目录中已有的同名文件，供用户确认是否覆盖。 */
async function module002FindExistingExportFiles(module002DirectoryHandle, module002Files) {
  const module002ExistingNames = [];
  for (const module002File of module002Files) {
    try {
      await module002DirectoryHandle.getFileHandle(module002File.name);
      module002ExistingNames.push(module002File.name);
    } catch (module002Error) {
      if (module002Error?.name !== "NotFoundError") throw module002Error;
    }
  }
  return module002ExistingNames;
}

/** 在已获授权的目录内逐个写入生成文件，并在失败时保留已成功写入内容。 */
async function module002WriteExportFiles(module002DirectoryHandle, module002Files) {
  for (const module002File of module002Files) {
    const module002FileHandle = await module002DirectoryHandle.getFileHandle(
      module002File.name,
      { create: true },
    );
    const module002Writable = await module002FileHandle.createWritable();
    try {
      await module002Writable.write(module002File.blob);
      await module002Writable.close();
    } catch (module002Error) {
      await module002Writable.abort?.(module002Error).catch(() => {});
      throw module002Error;
    }
  }
}

/** 选择一次导出文件夹，将会议记录和勾选的附件写入同一路径。 */
export async function module002SaveExportBundle({
  module002Draft,
  module002Config,
  module002WorkspaceHandle,
  module002Options = {},
}) {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("当前浏览器不支持选择导出文件夹，请使用桌面版 Chrome 或 Edge");
  }
  const module002Files = await module002BuildExportFiles({
    module002Draft,
    module002Config,
    module002WorkspaceHandle,
    module002Options: {
      notice: module002Options.notice === true,
      attendance: module002Options.attendance === true,
    },
  });
  const module002DirectoryHandle = await window.showDirectoryPicker({
    id: "kt002-export-dir",
    mode: "readwrite",
  });
  const module002ExistingNames = await module002FindExistingExportFiles(
    module002DirectoryHandle,
    module002Files,
  );
  if (
    module002ExistingNames.length &&
    !window.confirm(`以下文件已存在，是否覆盖？\n${module002ExistingNames.join("\n")}`)
  ) {
    throw new DOMException("用户取消覆盖", "AbortError");
  }
  await module002WriteExportFiles(module002DirectoryHandle, module002Files);
  return {
    fingerprint: await module002CreateDraftFingerprint(module002Draft),
    fileNames: module002Files.map((module002File) => module002File.name),
  };
}
