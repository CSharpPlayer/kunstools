import {
  module002GetCommitteeTopicSummaryLines,
  module002IsCommitteeMeeting,
} from "../domain/module002CommitteeMeeting";

const module002AttendanceMappingFields = Object.freeze([
  "organization",
  "meetingName",
  "topics",
]);

/** 将 Excel 单元格范围拆为左上、右下地址，拒绝不明确的映射写法。 */
function module002ParseCellRange(module002Range) {
  const module002Match = String(module002Range ?? "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
  if (!module002Match) {
    throw new Error("签到簿映射需填写合并单元格范围，例如 C3:F3");
  }
  return { start: module002Match[1], end: module002Match[2] };
}

/** 验证每个签到簿字段都指向同一张工作表内的完整合并单元格。 */
function module002ValidateAttendanceMapping(module002Worksheet, module002Mapping) {
  const module002Ranges = module002AttendanceMappingFields.map((module002Field) => {
    const module002Range = module002ParseCellRange(module002Mapping[module002Field]);
    const module002Start = module002Worksheet.getCell(module002Range.start);
    const module002End = module002Worksheet.getCell(module002Range.end);
    if (
      !module002Start.isMerged ||
      module002Start.master?.address !== module002Start.address ||
      module002End.master?.address !== module002Start.address
    ) {
      throw new Error(`签到簿“${module002Field}”必须映射到完整的合并单元格区域`);
    }
    return module002Range;
  });
  if (new Set(module002Ranges.map((module002Range) => `${module002Range.start}:${module002Range.end}`)).size !== module002Ranges.length) {
    throw new Error("签到簿的三个字段不能映射到同一个单元格区域");
  }
  return Object.fromEntries(
    module002AttendanceMappingFields.map((module002Field, module002Index) => [
      module002Field,
      module002Ranges[module002Index],
    ]),
  );
}

/** 根据预留的 C4:F4 高度估算会议议题的可读字号，过长时阻止导出。 */
function module002GetAttendanceTopicsFontSize(module002Topics) {
  const module002Length = module002Topics.replace(/\n/g, "").length;
  if (module002Length <= 90) return 16;
  if (module002Length <= 150) return 14;
  if (module002Length <= 210) return 12;
  if (module002Length <= 260) return 10;
  throw new Error("签到簿会议内容过长，请精简议题后再导出");
}

/** 将会议草稿转换为签到簿中约定的三个字段文本。 */
export function module002BuildAttendanceContent(module002Draft, module002Config) {
  const module002Branch = module002Config.branches.find(
    (module002Item) => module002Item.id === module002Draft.branchId,
  );
  if (!module002Branch?.name) throw new Error("当前会议未找到所属党支部");
  const module002MeetingName = module002Draft.meetingInfo.meetingName.trim();
  if (!module002MeetingName) throw new Error("请先填写会议名称后再导出签到簿");
  const module002Topics = module002IsCommitteeMeeting(module002Draft)
    ? module002GetCommitteeTopicSummaryLines(module002Draft)
        .map((module002Topic, module002Index) => `${module002Index + 1}. ${module002Topic}`)
        .join("\n")
    : module002Draft.topics
        .map((module002Topic, module002Index) => {
          const module002Title = module002Topic.title.trim();
          return module002Title ? `${module002Index + 1}. ${module002Title}` : "";
        })
        .filter(Boolean)
        .join("\n");
  if (!module002Topics) throw new Error("请先补充至少一个会议议题后再导出签到簿");
  return {
    organization: `宁江直属库有限公司${module002Branch.name}`,
    meetingName: module002MeetingName,
    topics: module002Topics,
  };
}

/** 在不改变签到簿表格版式的情况下，填入单位、会议名称和逐行议题。 */
export async function module002BuildAttendanceXlsx({
  module002TemplateFile,
  module002Mapping,
  module002Content,
}) {
  const module002ExcelModule = await import("exceljs");
  const module002Excel = module002ExcelModule.default ?? module002ExcelModule;
  const module002Workbook = new module002Excel.Workbook();
  const module002TemplateBytes = new Uint8Array(
    await module002TemplateFile.arrayBuffer(),
  );
  await module002Workbook.xlsx.load(module002TemplateBytes);
  const module002Worksheet = module002Workbook.worksheets[0];
  if (!module002Worksheet) throw new Error("签到簿模板不含工作表");
  const module002Ranges = module002ValidateAttendanceMapping(
    module002Worksheet,
    module002Mapping,
  );
  const module002TopicsFontSize = module002GetAttendanceTopicsFontSize(
    module002Content.topics,
  );
  module002AttendanceMappingFields.forEach((module002Field) => {
    const module002Cell = module002Worksheet.getCell(module002Ranges[module002Field].start);
    module002Cell.value = module002Content[module002Field];
    module002Cell.alignment = {
      ...module002Cell.alignment,
      horizontal: "center",
      vertical: "middle",
      wrapText: module002Field === "topics",
    };
    if (module002Field === "topics") {
      module002Cell.font = {
        ...module002Cell.font,
        size: module002TopicsFontSize,
      };
    }
  });
  const module002Buffer = await module002Workbook.xlsx.writeBuffer();
  return new Blob(
    [module002Buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
}
