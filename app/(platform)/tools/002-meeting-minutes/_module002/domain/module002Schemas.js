import { z } from "zod";

export const module002WorkspaceFormatVersion = 4;
export const module002DraftFormatVersion = 1;
export const module002PlaceholderPrompt = "【待用户提供真实业务Prompt】";
export const module002SpeechLengthFieldId = "speechLength";

/** 判断人物卡的发言字数是否为允许发送给 AI 的正整数。 */
export function module002IsValidSpeechLength(module002Value) {
  return /^[1-9]\d*$/.test(String(module002Value ?? "").trim());
}

export const module002ModuleTypeSchema = z.enum([
  "mainTitle",
  "meetingSummary",
  "topicSummary",
  "hostOpening",
  "topicDetails",
  "groupSpeeches",
  "hostClosing",
  "staticText",
  "customField",
]);

/** 当前已确认并可在会议编辑区选择的会议类型。 */
export const module002MeetingTypeSchema = z.enum([
  "partyCongress",
  "committeeMeeting",
]);

export const module002TextStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSizePt: z.number().min(8).max(72),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#000000"),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  firstLineIndentChars: z.number().min(0).max(10).default(0),
  leftIndentChars: z.number().min(0).max(20).default(0),
  rightIndentChars: z.number().min(0).max(20).default(0),
  lineSpacingPt: z.number().min(12).max(60).default(28),
});

/** 模板模块仅记录用户明确选择的格式，不能把正文默认值误写成模块覆盖。 */
export const module002TextStyleOverrideSchema = z.object({
  fontFamily: z.string().min(1).optional(),
  fontSizePt: z.number().min(8).max(72).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  firstLineIndentChars: z.number().min(0).max(10).optional(),
  leftIndentChars: z.number().min(0).max(20).optional(),
  rightIndentChars: z.number().min(0).max(20).optional(),
  lineSpacingPt: z.number().min(12).max(60).optional(),
});

export const module002DocumentFormatSchema = z.object({
  paper: z.literal("A4"),
  orientation: z.literal("portrait"),
  marginTopCm: z.number().min(1).max(6),
  marginBottomCm: z.number().min(1).max(6),
  marginLeftCm: z.number().min(1).max(6),
  marginRightCm: z.number().min(1).max(6),
  body: module002TextStyleSchema,
  mainTitle: module002TextStyleSchema,
  secondTitle: module002TextStyleSchema,
  thirdTitle: module002TextStyleSchema,
});

export const module002TemplateModuleSchema = z.object({
  id: z.string().min(1),
  type: module002ModuleTypeSchema,
  label: z.string().min(1),
  staticText: z.string().default(""),
  customField: z
    .object({
      fieldName: z.string().min(1),
      displayLabel: z.string().default(""),
      defaultValue: z.string().default(""),
      placeholder: z.string().default(""),
      required: z.boolean().default(false),
      multiline: z.boolean().default(false),
      sendToAi: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  styleOverride: module002TextStyleOverrideSchema.default({}),
});

export const module002TemplateSchema = z.object({
  id: z.string().min(1),
  branchId: z.string().min(1),
  name: z.string().min(1),
  meetingType: module002MeetingTypeSchema.default("partyCongress"),
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  defaultPrompt: z.string(),
  defaults: z.object({
    location: z.string().default(""),
    hostPersonId: z.string().nullable().default(null),
    recorderPersonId: z.string().nullable().default(null),
  }),
  modules: z.array(module002TemplateModuleSchema),
});

export const module002BranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
});

export const module002PersonFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["singleLine", "multiLine"]),
  builtIn: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});

export const module002PersonSchema = z.object({
  id: z.string().min(1),
  branchId: z.string().min(1),
  order: z.number().int().nonnegative(),
  name: z.string(),
  values: z.record(z.string(), z.string()).default({}),
  isExample: z.boolean().default(false),
});

/** 通知模板中六段可由用户映射的业务文字位置。 */
export const module002NoticeTemplateMappingSchema = z.object({
  title: z.number().int().nonnegative().nullable().default(null),
  recipient: z.number().int().nonnegative().nullable().default(null),
  explanation: z.number().int().nonnegative().nullable().default(null),
  topics: z.number().int().nonnegative().nullable().default(null),
  attire: z.number().int().nonnegative().nullable().default(null),
  signatureDate: z.number().int().nonnegative().nullable().default(null),
});

/** 签到簿中三项可由用户映射的合并单元格区域。 */
export const module002AttendanceTemplateMappingSchema = z.object({
  organization: z.string().default(""),
  meetingName: z.string().default(""),
  topics: z.string().default(""),
});

/** 保存内置或本地自定义的通知、签到簿模板和字段映射。 */
export const module002ExportTemplatesSchema = z.object({
  notice: z.object({
    source: z.enum(["builtIn", "custom"]).default("builtIn"),
    customFileName: z.string().nullable().default(null),
    mapping: module002NoticeTemplateMappingSchema,
  }),
  attendance: z.object({
    source: z.enum(["builtIn", "custom"]).default("builtIn"),
    customFileName: z.string().nullable().default(null),
    mapping: module002AttendanceTemplateMappingSchema,
  }),
});

export const module002WorkspaceConfigSchema = z.object({
  formatVersion: z.literal(module002WorkspaceFormatVersion),
  workspaceId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  branches: z.array(module002BranchSchema).length(3),
  templates: z.array(module002TemplateSchema),
  personFields: z.array(module002PersonFieldSchema).min(5),
  people: z.array(module002PersonSchema),
  documentFormat: module002DocumentFormatSchema,
  exportTemplates: module002ExportTemplatesSchema.default({
    notice: {
      source: "builtIn",
      customFileName: null,
      mapping: {
        title: 7,
        recipient: 9,
        explanation: 10,
        topics: 11,
        attire: 12,
        signatureDate: 22,
      },
    },
    attendance: {
      source: "builtIn",
      customFileName: null,
      mapping: {
        organization: "C2:F2",
        meetingName: "C3:F3",
        topics: "C4:F4",
      },
    },
  }),
  settings: z.object({
    preferredModel: z.string().min(1),
  }),
});

export const module002TopicSourceSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  title: z.string().default(""),
  fileType: z.enum(["docx", "pdf", "image"]),
  status: z.enum(["pending", "parsing", "ready", "needsSelection", "failed"]),
  selectedText: z.string().default(""),
  candidates: z.array(z.string()).default([]),
  error: z.string().nullable().default(null),
});

export const module002TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  order: z.number().int().nonnegative(),
  firstTopicLocked: z.boolean().default(false),
  sources: z.array(module002TopicSourceSchema).default([]),
});

export const module002MeetingInfoSchema = z.object({
  meetingName: z.string(),
  meetingType: module002MeetingTypeSchema.default("partyCongress"),
  date: z.string(),
  time: z.string(),
  location: z.string(),
  attendeePersonIds: z.array(z.string()),
  absentPersonIds: z.array(z.string()),
  observers: z.string(),
  hostPersonId: z.string().nullable(),
  recorderPersonId: z.string().nullable(),
});

export const module002EditorBlockSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  moduleType: module002ModuleTypeSchema,
  referenceId: z.string().nullable().default(null),
  content: z.any(),
});

export const module002DraftSchema = z.object({
  formatVersion: z.literal(module002DraftFormatVersion),
  draftId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  templateId: z.string().min(1),
  templateSnapshot: module002TemplateSchema,
  documentFormatSnapshot: module002DocumentFormatSchema,
  branchId: z.string().min(1),
  meetingInfo: module002MeetingInfoSchema,
  topics: z.array(module002TopicSchema),
  speakerPersonIds: z.array(z.string()),
  includeHostInSpeeches: z.boolean(),
  prompt: z.string(),
  hostOpening: z.string(),
  speeches: z.record(z.string(), z.string()),
  customValues: z.record(z.string(), z.string()),
  editorBlocks: z.array(module002EditorBlockSchema),
  exportedFingerprint: z.string().nullable(),
  examplePeopleConfirmed: z.boolean(),
});

export const module002ManifestSchema = z.object({
  formatVersion: z.literal(module002WorkspaceFormatVersion),
  workspaceId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  compatibleApp: z.literal("kunstools-module002"),
});

export const module002AiResultSchema = z.object({
  speeches: z.array(
    z
      .object({
        personId: z.string().min(1).optional(),
        serialNumber: z.string().min(1).optional(),
        name: z.string().min(1),
        content: z.string().min(1),
      })
      .refine(
        (module002Speech) =>
          Boolean(module002Speech.personId) !== Boolean(module002Speech.serialNumber),
        "每条发言只能使用人物 ID 或序号中的一种标识",
      ),
  ),
});

export const module002SingleSpeechResultSchema = z
  .object({
    personId: z.string().min(1).optional(),
    serialNumber: z.string().min(1).optional(),
    name: z.string().min(1),
    content: z.string().min(1),
  })
  .refine(
    (module002Speech) =>
      Boolean(module002Speech.personId) !== Boolean(module002Speech.serialNumber),
    "单人发言只能使用人物 ID 或序号中的一种标识",
  );
