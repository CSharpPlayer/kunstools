import { module002PlaceholderPrompt } from "./module002Schemas";

/** 获取当前支部人物，避免跨支部选择。 */
export function module002GetBranchPeople(module002Config, module002BranchId) {
  return module002Config.people
    .filter((module002Person) => module002Person.branchId === module002BranchId)
    .sort((module002Left, module002Right) => module002Left.order - module002Right.order);
}

/** 把 ISO 日期转换为公文使用的中文日期。 */
export function module002FormatChineseDate(module002Date) {
  const [module002Year, module002Month, module002Day] = module002Date
    .split("-")
    .map(Number);
  if (!module002Year || !module002Month || !module002Day) return module002Date;
  return `${module002Year}年${module002Month}月${module002Day}日`;
}

/** 把议题序号转换为中文大写序号，供详细记录的二级标题使用。 */
export function module002FormatTopicDetailOrdinal(module002Index) {
  const module002Number = module002Index + 1;
  const module002Digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (module002Number <= 10) return module002Number === 10 ? "十" : module002Digits[module002Number];
  if (module002Number < 20) return `十${module002Digits[module002Number - 10]}`;
  const module002Tens = Math.floor(module002Number / 10);
  const module002Ones = module002Number % 10;
  return `${module002Digits[module002Tens]}十${module002Ones ? module002Digits[module002Ones] : ""}`;
}

/** 返回人物卡序号升序的普通交流发言人，并确保主持人始终参与其中。 */
export function module002GetOrderedSpeakers(module002Draft, module002Config) {
  if (!module002Draft) return [];
  const module002SpeakerIds = new Set(module002Draft.speakerPersonIds);
  if (module002Draft.meetingInfo.hostPersonId) {
    module002SpeakerIds.add(module002Draft.meetingInfo.hostPersonId);
  }
  return module002Config.people
    .filter(
      (module002Person) =>
        module002Person.branchId === module002Draft.branchId &&
        module002SpeakerIds.has(module002Person.id),
    )
    .sort((module002Left, module002Right) => module002Left.order - module002Right.order);
}

/** 生成主持人固定的开头发言，明确邀请参会人员进行交流。 */
function module002BuildHostOpeningText(module002HostName) {
  return module002HostName
    ? `${module002HostName}，根据以上议题内容，请同志们简单进行一下交流发言。`
    : "";
}

/** 生成主持人固定的收尾总结，作为全部交流发言后的最后一段。 */
function module002BuildHostClosingText(module002HostName) {
  return module002HostName
    ? `${module002HostName}，今天的支部大会，议题就这么多，散会！`
    : "";
}

/** 生成会议情况说明，并标记时间与地点需要同一行两端对齐。 */
function module002BuildMeetingSummaryContent(
  module002Info,
  module002Names,
  module002Host,
  module002Recorder,
) {
  const module002TimeText = `时间：${module002FormatChineseDate(module002Info.date)}${module002Info.time ? ` ${module002Info.time}` : ""}`;
  const module002LocationText = `地点：${module002Info.location}`;
  const module002Lines = [
    `会议名称：${module002Info.meetingName}`,
    `${module002TimeText}\t${module002LocationText}`,
    `参加人员：${module002Names(module002Info.attendeePersonIds)}`,
    `缺席人员：${module002Names(module002Info.absentPersonIds)}`,
    `列席人员：${module002Info.observers.trim() || "无"}`,
    `主持人：${module002Host?.name ?? ""}        记录人：${module002Recorder?.name ?? ""}`,
  ];
  return {
    text: module002Lines.join("\n"),
    editorJson: {
      type: "doc",
      content: module002Lines.map((module002Line, module002Index) => ({
        type: "paragraph",
        attrs: module002Index === 1 ? { module002MeetingTimeLocation: true } : {},
        content: module002Index === 1
          ? [
              { type: "text", text: module002TimeText },
              { type: "module002MeetingTimeLocationSpacer" },
              { type: "text", text: module002LocationText },
            ]
          : (module002Line ? [{ type: "text", text: module002Line }] : []),
      })),
    },
  };
}

/** 为详细记录生成“二级标题 + 正文段落”的可编辑富文本初始结构。 */
function module002BuildTopicDetailsContent(module002Topics) {
  const module002Paragraphs = [];
  module002Topics.forEach((module002Topic, module002Index) => {
    module002Paragraphs.push({
      text: `${module002FormatTopicDetailOrdinal(module002Index)}、${module002Topic.title}`,
      title: true,
    });
    module002Topic.sources
      .map((module002Source) => module002Source.selectedText)
      .filter(Boolean)
      .flatMap((module002Text) => module002Text.split("\n"))
      .forEach((module002Text) => {
        module002Paragraphs.push({ text: module002Text, title: false });
      });
  });
  return {
    text: module002Paragraphs.map((module002Paragraph) => module002Paragraph.text).join("\n"),
    editorJson: {
      type: "doc",
      content: module002Paragraphs.map((module002Paragraph) => ({
        type: "paragraph",
        attrs: module002Paragraph.title
          ? { module002TopicDetailTitle: true }
          : {},
        content: module002Paragraph.text
          ? [{ type: "text", text: module002Paragraph.text }]
          : [],
      })),
    },
  };
}

/** 根据草稿和模板快照产生唯一的结构化文档块列表。 */
export function module002BuildDocumentBlocks(module002Draft, module002Config) {
  if (!module002Draft) return [];
  const module002PersonMap = new Map(
    module002Config.people.map((module002Person) => [module002Person.id, module002Person]),
  );
  const module002Info = module002Draft.meetingInfo;
  const module002Names = (module002Ids) =>
    module002Ids
      .map((module002Id) => module002PersonMap.get(module002Id)?.name)
      .filter(Boolean)
      .join("、") || "无";
  const module002Host = module002PersonMap.get(module002Info.hostPersonId);
  const module002Recorder = module002PersonMap.get(module002Info.recorderPersonId);
  const module002SystemStyleOverrides = {
    mainTitle: { firstLineIndentChars: 0 },
    meetingSummary: { firstLineIndentChars: 0 },
    topicSummary: { firstLineIndentChars: 0 },
  };

  return module002Draft.templateSnapshot.modules.flatMap((module002Module) => {
    let module002Text = "";
    let module002GeneratedEditorJson = null;
    switch (module002Module.type) {
      case "mainTitle":
        module002Text = `${module002Info.meetingName || "党员大会"}会议记录`;
        break;
      case "meetingSummary":
        {
          const module002MeetingSummary = module002BuildMeetingSummaryContent(
            module002Info,
            module002Names,
            module002Host,
            module002Recorder,
          );
          module002Text = module002MeetingSummary.text;
          module002GeneratedEditorJson = module002MeetingSummary.editorJson;
        }
        break;
      case "topicSummary":
        module002Text = `议题：\n${module002Draft.topics
          .map((module002Topic, module002Index) => `${module002Index + 1}.${module002Topic.title}`)
          .join("\n")}`;
        break;
      case "hostOpening":
        module002Text = module002BuildHostOpeningText(module002Host?.name);
        break;
      case "topicDetails":
        {
          const module002TopicDetails = module002BuildTopicDetailsContent(
            module002Draft.topics,
          );
          module002Text = module002TopicDetails.text;
          module002GeneratedEditorJson = module002TopicDetails.editorJson;
        }
        break;
      case "groupSpeeches":
        module002Text = module002GetOrderedSpeakers(module002Draft, module002Config)
          .map((module002Person) => {
            return module002Person
              ? `${module002Person.name}：${module002Draft.speeches[module002Person.id] ?? ""}`
              : "";
          })
          .filter(Boolean)
          .join("\n");
        break;
      case "hostClosing":
        module002Text = module002BuildHostClosingText(module002Host?.name);
        break;
      case "staticText":
        module002Text = module002Module.staticText;
        break;
      case "customField":
        module002Text = `${module002Module.customField?.displayLabel ?? ""}${
          module002Draft.customValues[module002Module.id] ?? ""
        }`;
        break;
      default:
        module002Text = "";
    }
    const module002EditedBlock = module002Draft.editorBlocks.find(
      (module002Block) => module002Block.moduleId === module002Module.id,
    );
    return [{
      id: `block-${module002Module.id}`,
      moduleId: module002Module.id,
      moduleType: module002Module.type,
      label: module002Module.label,
      styleOverride: {
        ...(module002SystemStyleOverrides[module002Module.type] ?? {}),
        ...module002Module.styleOverride,
      },
      text: module002EditedBlock?.content?.text ?? module002Text,
      editorJson:
        module002EditedBlock?.content?.json ?? module002GeneratedEditorJson,
    }];
  });
}

/** 返回仅包含议题材料与会议详细记录的 AI 正文，排除固定主持词与旧发言。 */
export function module002BuildAiDocumentBody(module002Draft, module002Config) {
  return module002BuildDocumentBlocks(module002Draft, module002Config)
    .filter((module002Block) =>
      ["topicSummary", "topicDetails"].includes(module002Block.moduleType),
    )
    .map((module002Block) => module002Block.text)
    .join("\n\n");
}

/** 实时生成可点击定位的生成前检查清单。 */
export function module002GetGenerationChecks(module002Draft, module002Config) {
  if (!module002Draft) return [{ key: "template", label: "请选择党支部模板", target: "template" }];
  const module002Info = module002Draft.meetingInfo;
  const module002Checks = [];
  if (!module002Info.meetingName.trim()) module002Checks.push({ key: "meetingName", label: "请填写会议名称", target: "meetingInfo" });
  if (!module002Info.date) module002Checks.push({ key: "date", label: "请选择会议日期", target: "meetingInfo" });
  if (!module002Info.time.trim()) module002Checks.push({ key: "time", label: "请填写具体时间", target: "meetingInfo" });
  if (!module002Info.location.trim()) module002Checks.push({ key: "location", label: "请填写地点", target: "meetingInfo" });
  if (!module002Info.hostPersonId || !module002Info.attendeePersonIds.includes(module002Info.hostPersonId)) module002Checks.push({ key: "host", label: "主持人必须在参加人员中", target: "meetingInfo" });
  if (!module002Info.recorderPersonId || !module002Info.attendeePersonIds.includes(module002Info.recorderPersonId)) module002Checks.push({ key: "recorder", label: "记录人必须在参加人员中", target: "meetingInfo" });
  if (!module002Draft.topics.length) module002Checks.push({ key: "topics", label: "请至少添加一个有效议题", target: "topics" });
  module002Draft.topics.forEach((module002Topic, module002Index) => {
    if (!module002Topic.title.trim()) module002Checks.push({ key: `topic-${module002Topic.id}`, label: `第 ${module002Index + 1} 个议题标题为空`, target: "topics" });
    if (!module002Topic.sources.length || module002Topic.sources.some((module002Source) => !module002Source.selectedText.trim())) module002Checks.push({ key: `source-${module002Topic.id}`, label: `第 ${module002Index + 1} 个议题仍有材料未取得合格原文`, target: "topics" });
  });
  if (!module002GetOrderedSpeakers(module002Draft, module002Config).length) module002Checks.push({ key: "speakers", label: "请至少勾选一位发言人", target: "speakers" });
  if (!module002Draft.prompt.trim() || module002Draft.prompt.includes(module002PlaceholderPrompt)) module002Checks.push({ key: "prompt", label: "请填写真实业务 Prompt", target: "speakers" });
  if (
    module002Draft.prompt.trim() &&
    !module002Draft.prompt.includes(module002PlaceholderPrompt)
  ) {
    ["{{CURRENT_DOCUMENT_BODY}}", "{{PERSON_CARDS}}"].forEach((module002Variable) => {
      if (!module002Draft.prompt.includes(module002Variable)) {
        module002Checks.push({
          key: `prompt-${module002Variable}`,
          label: `Prompt 缺少 ${module002Variable}`,
          target: "speakers",
        });
      }
    });
    const module002PromptIdentityField = module002Draft.prompt.includes(
      '"serialNumber"',
    )
      ? "serialNumber"
      : "personId";
    ["speeches", module002PromptIdentityField, "name", "content"].forEach(
      (module002Field) => {
        if (!module002Draft.prompt.includes(`"${module002Field}"`)) {
          module002Checks.push({
            key: `protocol-${module002Field}`,
            label: `固定 JSON 协议缺少字段 “${module002Field}”`,
            target: "speakers",
          });
        }
      },
    );
  }
  if (!module002Config.settings.preferredModel) module002Checks.push({ key: "model", label: "请选择可用模型", target: "speakers" });
  module002Draft.templateSnapshot.modules
    .filter(
      (module002Module) =>
        module002Module.type === "customField" &&
        module002Module.customField?.required,
    )
    .forEach((module002Module) => {
      if (!module002Draft.customValues[module002Module.id]?.trim()) {
        module002Checks.push({
          key: `custom-${module002Module.id}`,
          label: `请填写${module002Module.customField.fieldName}`,
          target: "meetingInfo",
        });
      }
    });
  const module002SelectedPeople = module002GetOrderedSpeakers(
    module002Draft,
    module002Config,
  );
  if (module002SelectedPeople.some((module002Person) => module002Person.isExample) && !module002Draft.examplePeopleConfirmed) module002Checks.push({ key: "examples", label: "示例人物尚未清理或本次确认", target: "people" });
  if (module002SelectedPeople.some((module002Person) => !module002Person.name.trim() || module002Person.name === "待填写姓名")) module002Checks.push({ key: "personNames", label: "所选人物仍有姓名未填写", target: "people" });
  const module002BranchNames = module002GetBranchPeople(module002Config, module002Draft.branchId)
    .map((module002Person) => module002Person.name.trim())
    .filter(Boolean);
  if (new Set(module002BranchNames).size !== module002BranchNames.length) module002Checks.push({ key: "duplicateNames", label: "当前支部存在重复姓名，请先处理", target: "people" });
  return module002Checks;
}

/** 在生成检查基础上增加正式导出的发言内容检查。 */
export function module002GetExportChecks(module002Draft, module002Config) {
  const module002Checks = module002GetGenerationChecks(
    module002Draft,
    module002Config,
  ).filter(
    (module002Check) =>
      module002Check.key !== "prompt" &&
      module002Check.key !== "model" &&
      module002Check.key !== "examples" &&
      !module002Check.key.startsWith("prompt-") &&
      !module002Check.key.startsWith("protocol-"),
  );
  if (!module002Draft) return module002Checks;
  module002GetOrderedSpeakers(module002Draft, module002Config).forEach((module002Person) => {
    if (!module002Draft.speeches[module002Person.id]?.trim()) {
      const module002Name = module002Person.name ?? "所选人员";
      module002Checks.push({ key: `speech-${module002Person.id}`, label: `${module002Name}的交流发言为空`, target: "document" });
    }
  });
  return module002Checks;
}
