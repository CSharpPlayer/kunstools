/** 支委会类型值，供模板、草稿和界面使用。 */
export const module002CommitteeMeetingType = "committeeMeeting";

/** 党员大会类型值，保留现有会议的默认行为。 */
export const module002PartyCongressMeetingType = "partyCongress";

/** 支委会预制的两项议题说明文字。 */
export const module002CommitteeTopicSummaryLines = Object.freeze([
  "1.传达学习习近平总书记系列重要讲话和重要会议精神；",
  "2.研究确定本月三会一课学习计划事宜。",
]);

/** 支委会预制的两个二级标题。 */
export const module002CommitteeSectionTitles = Object.freeze({
  first: "一、传达学习习近平总书记系列重要讲话和重要会议精神",
  second: "二、研究确定本月三会一课学习计划事宜",
});

/** 读取当前支委会可编辑的两项议题说明，供正文、通知和签到簿保持一致。 */
export function module002GetCommitteeTopicSummaryLines(module002Draft) {
  const module002EditedText = module002Draft?.editorBlocks?.find(
    (module002Block) => module002Block.moduleType === "topicSummary",
  )?.content?.text;
  const module002Lines = (module002EditedText || module002CommitteeTopicSummaryLines.join("\n"))
    .split("\n")
    .map((module002Line) =>
      module002Line
        .replace(/^\s*(?:[一二]、|\d+[.．、])\s*/, "")
        .trim(),
    )
    .filter((module002Line) => module002Line && module002Line !== "议题：");
  return module002CommitteeTopicSummaryLines.map(
    (module002Fallback, module002Index) =>
      module002Lines[module002Index] || module002Fallback.replace(/^\d+[.．、]\s*/, ""),
  );
}

/** 判断当前草稿是否使用支委会预制结构。 */
export function module002IsCommitteeMeeting(module002Draft) {
  return module002Draft?.meetingInfo?.meetingType === module002CommitteeMeetingType
    || module002Draft?.templateSnapshot?.meetingType === module002CommitteeMeetingType;
}

/** 读取人物卡的支部岗位，兼容尚未填写岗位的人员。 */
function module002GetCommitteeBranchRole(module002Person) {
  return module002Person?.values?.branchRole?.trim() ?? "";
}

/** 取得当前支部按人物卡序号排序的全部书记。 */
export function module002GetCommitteeSecretaries(module002Draft, module002Config) {
  if (!module002Draft) return [];
  return module002Config.people
    .filter(
      (module002Person) =>
        module002Person.branchId === module002Draft.branchId
        && module002GetCommitteeBranchRole(module002Person).includes("书记"),
    )
    .sort((module002Left, module002Right) => module002Left.order - module002Right.order);
}

/** 取得默认承担支委会传达和两次书记发言的书记。 */
export function module002GetCommitteeSecretary(module002Draft, module002Config) {
  return module002GetCommitteeSecretaries(module002Draft, module002Config)[0] ?? null;
}

/** 取得出席且支部岗位含“委员”或“书记”的支委，书记排在最后。 */
export function module002GetCommitteePeople(module002Draft, module002Config) {
  if (!module002Draft) return [];
  const module002AttendeeIds = new Set(module002Draft.meetingInfo.attendeePersonIds);
  return module002Config.people
    .filter((module002Person) => {
      const module002Role = module002GetCommitteeBranchRole(module002Person);
      return module002Person.branchId === module002Draft.branchId
        && module002AttendeeIds.has(module002Person.id)
        && (module002Role.includes("委员") || module002Role.includes("书记"));
    })
    .sort((module002Left, module002Right) => {
      const module002LeftIsSecretary = module002GetCommitteeBranchRole(module002Left).includes("书记");
      const module002RightIsSecretary = module002GetCommitteeBranchRole(module002Right).includes("书记");
      if (module002LeftIsSecretary !== module002RightIsSecretary) {
        return module002LeftIsSecretary ? 1 : -1;
      }
      return module002Left.order - module002Right.order;
    });
}

/** 返回支委会中除书记外需要普通交流发言的委员。 */
export function module002GetCommitteeMembers(module002Draft, module002Config) {
  return module002GetCommitteePeople(module002Draft, module002Config).filter(
    (module002Person) => !module002GetCommitteeBranchRole(module002Person).includes("书记"),
  );
}

/** 按党员大会既有“第一议题锁定”规则划分每份支委会材料所属大节。 */
export function module002GetCommitteeSourceRecords(module002Draft) {
  if (!module002Draft) return [];
  return module002Draft.topics.flatMap((module002Topic) =>
    module002Topic.sources.map((module002Source) => ({
      topicId: module002Topic.id,
      source: module002Source,
      section: module002Topic.firstTopicLocked ? "first" : "second",
    })),
  );
}

/** 将支委会逐份材料的发言稳定存放到既有 speeches 字典。 */
export function module002GetCommitteeSpeechKey(
  module002SourceId,
  module002Kind,
  module002PersonId = "",
) {
  return ["committee", module002SourceId, module002Kind, module002PersonId]
    .filter(Boolean)
    .join(":");
}

/** 生成支委会固定的书记传达事实陈述，不读取任何材料原文。 */
export function module002BuildCommitteeSecretaryConveyText(module002SecretaryName) {
  return module002SecretaryName
    ? `党支部书记${module002SecretaryName}同志传达。`
    : "";
}
