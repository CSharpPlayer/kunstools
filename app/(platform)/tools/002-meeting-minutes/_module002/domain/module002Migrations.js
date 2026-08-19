import {
  module002DraftSchema,
  module002SpeechLengthFieldId,
  module002PlaceholderPrompt,
  module002WorkspaceConfigSchema,
  module002WorkspaceFormatVersion,
} from "./module002Schemas";
import {
  module002CreateCommitteeMeetingTemplate,
  module002CreatePartyCongressTemplate,
  module002CreateThirdBranchPresetPeople,
  module002GetDefaultSpeechLength,
} from "./module002Factories";
import {
  module002ThirdBranchCommitteeMeetingDefaultPrompt,
  module002ThirdBranchPartyCongressDefaultPrompt,
} from "./module002Presets";
import {
  module002CommitteeMeetingType,
  module002PartyCongressMeetingType,
} from "./module002CommitteeMeeting";

const module002LegacyImplicitStyleOverride = {
  bold: false,
  italic: false,
  underline: false,
  color: "#000000",
  align: "left",
  firstLineIndentChars: 0,
  leftIndentChars: 0,
  rightIndentChars: 0,
  lineSpacingPt: 28,
};

/** 清除首版 schema 为“空覆盖”自动补出的正文默认值，恢复模块继承格式。 */
function module002IsLegacyImplicitStyleOverride(module002StyleOverride) {
  const module002Keys = Object.keys(module002LegacyImplicitStyleOverride);
  return (
    module002StyleOverride &&
    Object.keys(module002StyleOverride).length === module002Keys.length &&
    module002Keys.every(
      (module002Key) =>
        module002StyleOverride[module002Key] ===
        module002LegacyImplicitStyleOverride[module002Key],
    )
  );
}

/** 迁移配置或草稿中的模板快照，保留用户真实覆盖。 */
function module002NormalizeTemplateStyleOverrides(module002Template) {
  const module002Modules = (module002Template.modules ?? []).map((module002Module) => ({
    ...module002Module,
    styleOverride: module002IsLegacyImplicitStyleOverride(
      module002Module.styleOverride,
    )
      ? {}
      : module002Module.styleOverride,
  }));
  const module002GroupSpeechIndex = module002Modules.findIndex(
    (module002Module) => module002Module.type === "groupSpeeches",
  );
  const module002HasHostOpening = module002Modules.some(
    (module002Module) => module002Module.type === "hostOpening",
  );
  const module002HasHostClosing = module002Modules.some(
    (module002Module) => module002Module.type === "hostClosing",
  );
  if (module002HasHostOpening && module002GroupSpeechIndex >= 0 && !module002HasHostClosing) {
    module002Modules.splice(module002GroupSpeechIndex + 1, 0, {
      id: `module-${module002Template.id}-host-closing`,
      type: "hostClosing",
      label: "主持人总结发言",
      staticText: "",
      customField: null,
      styleOverride: {},
    });
  }
  return {
    ...module002Template,
    meetingType:
      module002Template.meetingType
      ?? (module002Template.name === "支委会"
        ? module002CommitteeMeetingType
        : module002PartyCongressMeetingType),
    defaultPrompt: module002Template.defaultPrompt
      ?.replace(/\n*发言顺序：\s*\n\{\{SPEAKER_ORDER\}\}/, ""),
    modules: module002Modules,
  };
}

/** 为每个既有党支部补齐党员大会、支委会各一套可直接新建的预制模板。 */
function module002EnsureMeetingTypeTemplates(module002Raw) {
  const module002Templates = [...(module002Raw.templates ?? [])];
  (module002Raw.branches ?? []).forEach((module002Branch) => {
    const module002BranchTemplates = module002Templates.filter(
      (module002Template) => module002Template.branchId === module002Branch.id,
    );
    const module002Defaults = module002BranchTemplates[0]?.defaults ?? {};
    if (
      !module002BranchTemplates.some(
        (module002Template) =>
          module002Template.meetingType === module002PartyCongressMeetingType,
      )
    ) {
      module002Templates.push(
        module002CreatePartyCongressTemplate(
          module002Branch.id,
          module002Defaults,
          module002Branch.name,
        ),
      );
    }
    if (
      !module002BranchTemplates.some(
        (module002Template) =>
          module002Template.meetingType === module002CommitteeMeetingType,
      )
    ) {
      module002Templates.push(
        module002CreateCommitteeMeetingTemplate(
          module002Branch.id,
          module002Defaults,
          module002Branch.name,
        ),
      );
    }
  });
  return { ...module002Raw, templates: module002Templates };
}

/** 将历史草稿与配置中的议题标题统一为已确认的缩进与不加粗样式。 */
function module002NormalizeSecondTitle(module002DocumentFormat) {
  if (!module002DocumentFormat) return module002DocumentFormat;
  return {
    ...module002DocumentFormat,
    secondTitle: module002DocumentFormat.secondTitle
      ? {
          ...module002DocumentFormat.secondTitle,
          bold: false,
          firstLineIndentChars: 2,
        }
      : module002DocumentFormat.secondTitle,
    thirdTitle: module002DocumentFormat.thirdTitle
      ? {
          ...module002DocumentFormat.thirdTitle,
          firstLineIndentChars: 2,
        }
      : module002DocumentFormat.thirdTitle,
  };
}

/** 为历史工作区补入不可删除的发言字数列，并保留同名自定义列已有数据。 */
function module002NormalizeSpeechLengthPersonField(module002Raw) {
  const module002ExistingFields = module002Raw.personFields ?? [];
  const module002ShouldSeedSpeechLength =
    module002Raw.formatVersion < module002WorkspaceFormatVersion;
  const module002LegacySpeechLengthField = module002ExistingFields.find(
    (module002Field) =>
      module002Field.id !== module002SpeechLengthFieldId
      && module002Field.label === "发言字数",
  );
  const module002BuiltInFields = [
    ["serialNumber", "序号"],
    ["name", "姓名"],
    ["branchRole", "支部岗位"],
    ["businessRole", "业务岗位"],
    [module002SpeechLengthFieldId, "发言字数"],
  ].map(([module002Id, module002Label], module002Order) => ({
    ...(module002ExistingFields.find((module002Field) => module002Field.id === module002Id) ?? {}),
    id: module002Id,
    label: module002Label,
    type: "singleLine",
    builtIn: true,
    order: module002Order,
  }));
  const module002BuiltInIds = new Set(
    module002BuiltInFields.map((module002Field) => module002Field.id),
  );
  const module002CustomFields = module002ExistingFields
    .filter(
      (module002Field) =>
        !module002BuiltInIds.has(module002Field.id)
        && module002Field.id !== module002LegacySpeechLengthField?.id,
    )
    .map((module002Field, module002Index) => ({
      ...module002Field,
      order: module002BuiltInFields.length + module002Index,
    }));
  const module002LegacySpeechLengthId = module002LegacySpeechLengthField?.id;

  return {
    ...module002Raw,
    personFields: [...module002BuiltInFields, ...module002CustomFields],
    people: (module002Raw.people ?? []).map((module002Person) => {
      const module002LegacySpeechLength =
        module002LegacySpeechLengthId
        && module002LegacySpeechLengthId !== module002SpeechLengthFieldId
          ? module002Person.values?.[module002LegacySpeechLengthId]
          : undefined;
      const module002StoredSpeechLength =
        module002Person.values?.[module002SpeechLengthFieldId]?.trim();
      const module002NextSpeechLength =
        module002StoredSpeechLength
        || module002LegacySpeechLength?.trim()
        || (
          module002ShouldSeedSpeechLength
            ? module002GetDefaultSpeechLength(module002Person.name)
            : ""
        );
      const module002Values = { ...(module002Person.values ?? {}) };
      if (module002LegacySpeechLengthId) {
        delete module002Values[module002LegacySpeechLengthId];
      }
      return {
        ...module002Person,
        values: {
          ...module002Values,
          [module002SpeechLengthFieldId]: module002NextSpeechLength,
        },
      };
    }),
  };
}

/** 将旧草稿中的制表符时间行升级为不拉开文字的可伸缩分隔节点。 */
function module002NormalizeMeetingTimeLocationEditorBlock(module002EditorBlock) {
  if (module002EditorBlock.moduleType !== "meetingSummary") return module002EditorBlock;
  const module002EditorJson = module002EditorBlock.content?.json;
  if (module002EditorJson?.type !== "doc") return module002EditorBlock;
  return {
    ...module002EditorBlock,
    content: {
      ...module002EditorBlock.content,
      json: {
        ...module002EditorJson,
        content: (module002EditorJson.content ?? []).map((module002Paragraph) => {
          if (
            module002Paragraph.attrs?.module002MeetingTimeLocation !== true ||
            (module002Paragraph.content ?? []).some(
              (module002Node) =>
                module002Node.type === "module002MeetingTimeLocationSpacer",
            )
          ) {
            return module002Paragraph;
          }
          const module002ParagraphText = (module002Paragraph.content ?? [])
            .map((module002Node) => module002Node.text ?? "")
            .join("");
          const module002TimeLocationMatch = module002ParagraphText.match(
            /^(时间：.*?)(?:\t| {2,})(地点：.*)$/,
          );
          if (!module002TimeLocationMatch) return module002Paragraph;
          return {
            ...module002Paragraph,
            content: [
              { type: "text", text: module002TimeLocationMatch[1] },
              { type: "module002MeetingTimeLocationSpacer" },
              { type: "text", text: module002TimeLocationMatch[2] },
            ],
          };
        }),
      },
    },
  };
}

/** 安全补齐第三党支部默认 Prompt 与首版人物；已有真实人员和人工 Prompt 不覆盖。 */
function module002NormalizeThirdBranchPresets(module002Raw) {
  const module002ThirdBranch = (module002Raw.branches ?? []).find(
    (module002Branch) => module002Branch.order === 2,
  );
  if (!module002ThirdBranch) return module002Raw;
  const module002ThirdBranchPeople = (module002Raw.people ?? []).filter(
    (module002Person) => module002Person.branchId === module002ThirdBranch.id,
  );
  const module002ShouldSeedPeople = module002ThirdBranchPeople.length === 0;
  const module002PresetPeople = module002ShouldSeedPeople
    ? module002CreateThirdBranchPresetPeople(module002ThirdBranch.id)
    : [];
  const module002HostId = module002PresetPeople.find(
    (module002Person) => module002Person.name === "李万庄",
  )?.id;
  const module002RecorderId = module002PresetPeople.find(
    (module002Person) => module002Person.name === "李翔鲲",
  )?.id;

  return {
    ...module002Raw,
    people: module002ShouldSeedPeople
      ? [...(module002Raw.people ?? []), ...module002PresetPeople]
      : module002Raw.people,
    templates: (module002Raw.templates ?? []).map((module002Template) => {
      const module002IsThirdBranchPartyCongress =
        module002Template.branchId === module002ThirdBranch.id &&
        module002Template.meetingType === module002PartyCongressMeetingType;
      const module002IsThirdBranchCommitteeMeeting =
        module002Template.branchId === module002ThirdBranch.id &&
        module002Template.meetingType === module002CommitteeMeetingType;
      if (
        !module002IsThirdBranchPartyCongress
        && !module002IsThirdBranchCommitteeMeeting
      ) {
        return module002Template;
      }
      return {
        ...module002Template,
        defaultPrompt:
          module002Template.defaultPrompt === module002PlaceholderPrompt
            ? module002IsThirdBranchCommitteeMeeting
              ? module002ThirdBranchCommitteeMeetingDefaultPrompt
              : module002ThirdBranchPartyCongressDefaultPrompt
            : module002Template.defaultPrompt,
        defaults: module002ShouldSeedPeople
          ? {
              ...module002Template.defaults,
              hostPersonId: module002HostId ?? null,
              recorderPersonId: module002RecorderId ?? null,
            }
          : module002Template.defaults,
      };
    }),
  };
}

/** 迁移配置对象中所有模板的空样式覆盖。 */
function module002NormalizeWorkspaceStyleOverrides(module002Raw) {
  const module002NormalizedPeople = module002NormalizeSpeechLengthPersonField(module002Raw);
  const module002NormalizedTemplates = {
    ...module002NormalizedPeople,
    exportTemplates: module002Raw.exportTemplates ?? undefined,
    documentFormat: module002NormalizeSecondTitle(module002Raw.documentFormat),
    templates: (module002Raw.templates ?? []).map(
      module002NormalizeTemplateStyleOverrides,
    ),
  };
  return module002EnsureMeetingTypeTemplates(
    module002NormalizeThirdBranchPresets(module002NormalizedTemplates),
  );
}

/** 校验并迁移工作区配置；首版只接受当前明确版本。 */
export function module002ParseWorkspaceConfig(module002Text) {
  const module002Raw = JSON.parse(module002Text);

  if (
    ![1, 2, 3, module002WorkspaceFormatVersion].includes(
      module002Raw?.formatVersion,
    )
  ) {
    throw new Error(
      `不支持的工作区版本：${module002Raw?.formatVersion ?? "未知"}`,
    );
  }

  return module002WorkspaceConfigSchema.parse({
    ...module002NormalizeWorkspaceStyleOverrides(module002Raw),
    formatVersion: module002WorkspaceFormatVersion,
  });
}

/** 校验并迁移当前草稿；损坏内容不会覆盖已加载状态。 */
export function module002ParseDraft(module002Text) {
  const module002Raw = JSON.parse(module002Text);
  return module002DraftSchema.parse({
    ...module002Raw,
    prompt: module002Raw.prompt
      ?.replace(/\n*发言顺序：\s*\n\{\{SPEAKER_ORDER\}\}/, ""),
    documentFormatSnapshot: module002NormalizeSecondTitle(
      module002Raw.documentFormatSnapshot,
    ),
    templateSnapshot: module002NormalizeTemplateStyleOverrides(
      module002Raw.templateSnapshot,
    ),
    editorBlocks: (module002Raw.editorBlocks ?? []).map(
      module002NormalizeMeetingTimeLocationEditorBlock,
    ),
  });
}
