import { module002FormatChineseDate } from "./module002Document";
import {
  module002GetCommitteeTopicSummaryLines,
  module002IsCommitteeMeeting,
} from "./module002CommitteeMeeting";

const module002ChinaHolidayDatesByYear = Object.freeze({
  2025: new Set([
    "2025-01-01",
    "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04",
    "2025-04-04", "2025-04-05", "2025-04-06",
    "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05",
    "2025-05-31", "2025-06-01", "2025-06-02",
    "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",
  ]),
  // 依据国务院办公厅《2026年部分节假日安排》维护；新年度需在此补充官方日期表。
  2026: new Set([
    "2026-01-01", "2026-01-02", "2026-01-03",
    "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
    "2026-04-04", "2026-04-05", "2026-04-06",
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
    "2026-06-19", "2026-06-20", "2026-06-21",
    "2026-09-25", "2026-09-26", "2026-09-27",
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
  ]),
});

/** 将本地日期对象转换为稳定的 YYYY-MM-DD 字符串。 */
function module002FormatIsoDate(module002Date) {
  return [
    module002Date.getUTCFullYear(),
    String(module002Date.getUTCMonth() + 1).padStart(2, "0"),
    String(module002Date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 根据会议日期向前寻找可用的通知落款工作日；周末调休也不使用。 */
export function module002GetNoticeSignatureDate(module002MeetingDate) {
  const [module002Year, module002Month, module002Day] = module002MeetingDate
    .split("-")
    .map(Number);
  if (!module002Year || !module002Month || !module002Day) {
    throw new Error("会议日期格式不正确，无法计算通知落款日期");
  }
  const module002Cursor = new Date(Date.UTC(module002Year, module002Month - 1, module002Day));
  for (let module002Offset = 1; module002Offset <= 31; module002Offset += 1) {
    module002Cursor.setUTCDate(module002Cursor.getUTCDate() - 1);
    const module002Candidate = module002FormatIsoDate(module002Cursor);
    const module002CandidateYear = module002Cursor.getUTCFullYear();
    const module002Holidays = module002ChinaHolidayDatesByYear[module002CandidateYear];
    if (!module002Holidays) {
      throw new Error(`尚未维护 ${module002CandidateYear} 年法定节假日表，暂不能生成通知落款`);
    }
    const module002DayOfWeek = module002Cursor.getUTCDay();
    if (module002DayOfWeek === 0 || module002DayOfWeek === 6) continue;
    if (module002Holidays.has(module002Candidate)) continue;
    return module002Candidate;
  }
  throw new Error("未能在 31 天内计算通知落款日期");
}

/** 使用会议草稿构造通知模板六个业务字段的文字。 */
export function module002BuildNoticeContent(module002Draft, module002Config) {
  const module002Branch = module002Config.branches.find(
    (module002Item) => module002Item.id === module002Draft.branchId,
  );
  const module002MeetingName = module002Draft.meetingInfo.meetingName.trim();
  const module002Location = module002Draft.meetingInfo.location.trim();
  if (!module002Branch?.name) throw new Error("当前会议未找到所属党支部");
  if (!module002MeetingName) throw new Error("请先填写会议名称");
  if (!module002Location) throw new Error("请先填写会议地点后再导出通知");
  const module002MeetingDate = module002FormatChineseDate(module002Draft.meetingInfo.date);
  const module002MeetingTime = module002Draft.meetingInfo.time.trim();
  const module002DateTime = `${module002MeetingDate}${module002MeetingTime ? ` ${module002MeetingTime}` : ""}`;
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
  if (!module002Topics) throw new Error("请先补充至少一个会议议题后再导出通知");
  return {
    title: `关于召开${module002Branch.name}${module002MeetingName}的通知`,
    recipient: `${module002Branch.name}全体党员：`,
    explanation: `根据${module002Branch.name}“三会一课”计划安排，拟于${module002DateTime}开展${module002Branch.name}${module002MeetingName}，请全体党员按时参会，参会地点：${module002Location}。会议议题：`,
    topics: module002Topics,
    attire: "请参会党员着工装，佩戴党徽。",
    signatureDate: module002FormatChineseDate(
      module002GetNoticeSignatureDate(module002Draft.meetingInfo.date),
    ),
  };
}
