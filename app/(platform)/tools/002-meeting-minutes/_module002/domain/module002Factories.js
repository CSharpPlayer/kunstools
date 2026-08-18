import {
  module002DraftSchema,
  module002WorkspaceConfigSchema,
} from "./module002Schemas";
import {
  module002ThirdBranchPartyCongressDefaultPrompt,
  module002ThirdBranchPresetPeople,
} from "./module002Presets";

/** 生成不依赖姓名或数组位置的稳定业务 ID。 */
export function module002CreateId(module002Prefix) {
  return `${module002Prefix}-${crypto.randomUUID()}`;
}

/** 返回本机当天的 YYYY-MM-DD 日期。 */
export function module002Today() {
  const module002Now = new Date();
  const module002Offset = module002Now.getTimezoneOffset() * 60_000;
  return new Date(module002Now.getTime() - module002Offset)
    .toISOString()
    .slice(0, 10);
}

/** 建立全站统一的首版公文格式。 */
export function module002CreateDefaultDocumentFormat() {
  const module002Body = {
    fontFamily: "仿宋_GB2312",
    fontSizePt: 16,
    bold: false,
    italic: false,
    underline: false,
    color: "#000000",
    align: "justify",
    firstLineIndentChars: 2,
    leftIndentChars: 0,
    rightIndentChars: 0,
    lineSpacingPt: 28,
  };

  return {
    paper: "A4",
    orientation: "portrait",
    marginTopCm: 3.7,
    marginBottomCm: 3.5,
    marginLeftCm: 2.8,
    marginRightCm: 2.6,
    body: module002Body,
    mainTitle: {
      ...module002Body,
      fontFamily: "方正小标宋简体",
      fontSizePt: 22,
      align: "center",
      firstLineIndentChars: 0,
    },
    secondTitle: {
      ...module002Body,
      fontFamily: "黑体",
      bold: false,
      align: "left",
      firstLineIndentChars: 2,
    },
    thirdTitle: {
      ...module002Body,
      fontFamily: "楷体_GB2312",
      align: "left",
      firstLineIndentChars: 0,
    },
  };
}

/** 建立第三党支部唯一的首版党员大会结构化模板。 */
export function module002CreatePartyCongressTemplate(
  module002BranchId,
  module002Defaults = {},
) {
  const module002Now = new Date().toISOString();
  const module002Module = (module002Type, module002Label) => ({
    id: module002CreateId("module"),
    type: module002Type,
    label: module002Label,
    staticText: "",
    customField: null,
    styleOverride: {},
  });

  return {
    id: module002CreateId("template"),
    branchId: module002BranchId,
    name: "党员大会",
    revision: 0,
    createdAt: module002Now,
    updatedAt: module002Now,
    defaultPrompt: module002ThirdBranchPartyCongressDefaultPrompt,
    defaults: {
      location: "",
      hostPersonId: module002Defaults.hostPersonId ?? null,
      recorderPersonId: module002Defaults.recorderPersonId ?? null,
    },
    modules: [
      module002Module("mainTitle", "主标题"),
      module002Module("meetingSummary", "会议情况说明"),
      module002Module("topicSummary", "议题说明"),
      module002Module("hostOpening", "主持人开头发言"),
      module002Module("topicDetails", "会议详细记录"),
      module002Module("groupSpeeches", "全体交流发言"),
      module002Module("hostClosing", "主持人总结发言"),
    ],
  };
}

/** 按预置名单建立第三党支部人物卡，序号与数组顺序保持一致。 */
export function module002CreateThirdBranchPresetPeople(module002BranchId) {
  return module002ThirdBranchPresetPeople.map((module002PresetPerson, module002Order) => ({
    id: module002CreateId("person"),
    branchId: module002BranchId,
    order: module002Order,
    name: module002PresetPerson.name,
    values: {
      branchRole: module002PresetPerson.branchRole,
      businessRole: module002PresetPerson.businessRole,
    },
    isExample: false,
  }));
}

/** 建立带第三党支部预制人员和默认 Prompt 的初始工作区。 */
export function module002CreateInitialWorkspace() {
  const module002Now = new Date().toISOString();
  const module002Branches = ["第一党支部", "第二党支部", "第三党支部"].map(
    (module002Name, module002Order) => ({
      id: module002CreateId("branch"),
      name: module002Name,
      order: module002Order,
    }),
  );
  const module002BuiltInFields = [
    ["serialNumber", "序号"],
    ["name", "姓名"],
    ["branchRole", "支部岗位"],
    ["businessRole", "业务岗位"],
  ].map(([module002Id, module002Label], module002Order) => ({
    id: module002Id,
    label: module002Label,
    type: "singleLine",
    builtIn: true,
    order: module002Order,
  }));
  const module002ThirdBranchPeople = module002CreateThirdBranchPresetPeople(
    module002Branches[2].id,
  );

  return module002WorkspaceConfigSchema.parse({
    formatVersion: 1,
    workspaceId: module002CreateId("workspace"),
    revision: 0,
    createdAt: module002Now,
    updatedAt: module002Now,
    branches: module002Branches,
    templates: [
      module002CreatePartyCongressTemplate(module002Branches[2].id, {
        hostPersonId: module002ThirdBranchPeople[0].id,
        recorderPersonId: module002ThirdBranchPeople[7].id,
      }),
    ],
    personFields: module002BuiltInFields,
    people: module002ThirdBranchPeople,
    documentFormat: module002CreateDefaultDocumentFormat(),
    settings: {
      preferredModel: "deepseek-v4-flash",
    },
  });
}

/** 按模板快照建立唯一一份当前会议草稿。 */
export function module002CreateDraft({
  module002Template,
  module002DocumentFormat,
  module002People,
}) {
  const module002Now = new Date().toISOString();
  const module002BranchPeople = module002People
    .filter((module002Person) => module002Person.branchId === module002Template.branchId)
    .sort((module002Left, module002Right) => module002Left.order - module002Right.order);
  const module002AttendeeIds = module002BranchPeople.map(
    (module002Person) => module002Person.id,
  );
  const module002CustomValues = Object.fromEntries(
    module002Template.modules
      .filter((module002Module) => module002Module.type === "customField")
      .map((module002Module) => [
        module002Module.id,
        module002Module.customField?.defaultValue ?? "",
      ]),
  );

  return module002DraftSchema.parse({
    formatVersion: 1,
    draftId: module002CreateId("draft"),
    revision: 0,
    createdAt: module002Now,
    updatedAt: module002Now,
    templateId: module002Template.id,
    templateSnapshot: structuredClone(module002Template),
    documentFormatSnapshot: structuredClone(module002DocumentFormat),
    branchId: module002Template.branchId,
    meetingInfo: {
      meetingName: module002Template.name,
      date: module002Today(),
      time: "",
      location: module002Template.defaults.location,
      attendeePersonIds: module002AttendeeIds,
      absentPersonIds: [],
      observers: "",
      hostPersonId: module002Template.defaults.hostPersonId,
      recorderPersonId: module002Template.defaults.recorderPersonId,
    },
    topics: [],
    speakerPersonIds: module002AttendeeIds,
    includeHostInSpeeches: true,
    prompt: module002Template.defaultPrompt,
    hostOpening: "",
    speeches: {},
    customValues: module002CustomValues,
    editorBlocks: [],
    exportedFingerprint: null,
    examplePeopleConfirmed: false,
  });
}
