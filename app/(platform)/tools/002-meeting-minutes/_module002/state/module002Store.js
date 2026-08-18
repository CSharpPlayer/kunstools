import { create } from "zustand";
import { module002CreateDraft, module002CreateId } from "../domain/module002Factories";

/** 清除由右侧权威配置影响的编辑器覆盖，避免双份状态循环覆盖。 */
function module002ClearBlockOverrides(module002Draft, module002Types) {
  return {
    ...module002Draft,
    editorBlocks: module002Draft.editorBlocks.filter(
      (module002Block) => !module002Types.includes(module002Block.moduleType),
    ),
  };
}

/** 统一为草稿命令增加修订号、更新时间并标记需要重新导出。 */
function module002ReviseDraft(module002Draft) {
  return {
    ...module002Draft,
    revision: module002Draft.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** 模块 002 的领域状态和命令中心。 */
export const useModule002Store = create((module002Set, module002Get) => ({
  module002WorkspaceHandle: null,
  module002Config: null,
  module002Draft: null,
  module002WorkspaceStatus: "loading",
  module002WorkspaceMessage: "正在检查本地工作区",
  module002ConfigDirty: false,
  module002DraftDirty: false,
  module002LastSavedAt: null,
  module002ActiveSection: null,

  /** 装入已校验工作区和唯一草稿。 */
  module002SetWorkspace(module002Handle, module002Config, module002Draft, module002Message = "") {
    module002Set({
      module002WorkspaceHandle: module002Handle,
      module002Config,
      module002Draft,
      module002WorkspaceStatus: "ready",
      module002WorkspaceMessage: module002Message,
      module002ConfigDirty: false,
      module002DraftDirty: false,
    });
  },

  /** 显示可恢复的工作区入口状态。 */
  module002SetWorkspaceStatus(module002WorkspaceStatus, module002WorkspaceMessage = "") {
    module002Set({ module002WorkspaceStatus, module002WorkspaceMessage });
  },

  /** 通过纯函数更新权威配置。 */
  module002UpdateConfig(module002Updater) {
    module002Set((module002State) => {
      const module002NextConfig = module002Updater(
        structuredClone(module002State.module002Config),
      );
      return {
        module002Config: {
          ...module002NextConfig,
          revision: module002State.module002Config.revision + 1,
          updatedAt: new Date().toISOString(),
        },
        module002ConfigDirty: true,
      };
    });
  },

  /** 通过纯函数更新当前草稿。 */
  module002UpdateDraft(module002Updater) {
    module002Set((module002State) => ({
      module002Draft: module002ReviseDraft(
        module002Updater(structuredClone(module002State.module002Draft)),
      ),
      module002DraftDirty: true,
    }));
  },

  /** 从所选模板和全局格式快照建立新草稿。 */
  module002StartDraft(module002TemplateId) {
    const module002Config = module002Get().module002Config;
    const module002Template = module002Config.templates.find(
      (module002Item) => module002Item.id === module002TemplateId,
    );
    if (!module002Template) throw new Error("所选模板不存在");
    module002Set({
      module002Draft: module002CreateDraft({
        module002Template,
        module002DocumentFormat: module002Config.documentFormat,
        module002People: module002Config.people,
      }),
      module002DraftDirty: true,
      module002ActiveSection: "meetingInfo",
    });
  },

  /** 更新会议信息并重建对应正文块。 */
  module002UpdateMeetingInfo(module002Patch) {
    module002Get().module002UpdateDraft((module002Draft) =>
      module002ClearBlockOverrides(
        {
          ...module002Draft,
          meetingInfo: { ...module002Draft.meetingInfo, ...module002Patch },
        },
        ["mainTitle", "meetingSummary", "hostOpening", "groupSpeeches", "hostClosing"],
      ),
    );
  },

  /** 更新议题单一数据源并同步议题列表与详细记录。 */
  module002SetTopics(module002Topics) {
    module002Get().module002UpdateDraft((module002Draft) =>
      module002ClearBlockOverrides(
        { ...module002Draft, topics: module002Topics },
        ["topicSummary", "topicDetails"],
      ),
    );
  },

  /** 更新发言人顺序和选择。 */
  module002SetSpeakers(module002SpeakerPersonIds) {
    module002Get().module002UpdateDraft((module002Draft) =>
      module002ClearBlockOverrides(
        { ...module002Draft, speakerPersonIds: module002SpeakerPersonIds },
        ["groupSpeeches"],
      ),
    );
  },

  /** 保存编辑器块，同时把可可靠解析的标题和议题改动同步回右侧。 */
  module002UpdateEditorBlock(module002Block, module002Content) {
    const module002Config = module002Get().module002Config;
    module002Get().module002UpdateDraft((module002Draft) => {
      const module002NextBlocks = module002Draft.editorBlocks.filter(
        (module002Item) => module002Item.moduleId !== module002Block.moduleId,
      );
      module002NextBlocks.push({
        id: module002Block.id,
        moduleId: module002Block.moduleId,
        moduleType: module002Block.moduleType,
        referenceId: null,
        content: module002Content,
      });
      const module002NextDraft = { ...module002Draft, editorBlocks: module002NextBlocks };
      if (module002Block.moduleType === "mainTitle") {
        module002NextDraft.meetingInfo.meetingName = module002Content.text
          .replace(/会议记录\s*$/, "")
          .trim();
      }
      if (module002Block.moduleType === "topicSummary") {
        const module002Titles = module002Content.text
          .split("\n")
          .map((module002Line) => module002Line.replace(/^\s*\d+[.．、]\s*/, "").trim())
          .filter((module002Line) => module002Line && module002Line !== "议题：");
        module002NextDraft.topics = module002NextDraft.topics.map(
          (module002Topic, module002Index) => ({
            ...module002Topic,
            title: module002Titles[module002Index] ?? module002Topic.title,
          }),
        );
      }
      if (module002Block.moduleType === "customField") {
        const module002TemplateModule = module002Draft.templateSnapshot.modules.find(
          (module002Item) => module002Item.id === module002Block.moduleId,
        );
        const module002Label = module002TemplateModule?.customField?.displayLabel ?? "";
        module002NextDraft.customValues[module002Block.moduleId] = module002Content.text.startsWith(module002Label)
          ? module002Content.text.slice(module002Label.length)
          : module002Content.text;
      }
      if (module002Block.moduleType === "meetingSummary") {
        const module002MeetingName = module002Content.text.match(/会议名称：([^\n]*)/)?.[1]?.trim();
        const module002Location = module002Content.text.match(/地点：([^\n]*)/)?.[1]?.trim();
        const module002DateTime = module002Content.text.match(
          /时间：(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(.+?))?\s+地点：/,
        );
        if (module002MeetingName !== undefined) module002NextDraft.meetingInfo.meetingName = module002MeetingName;
        if (module002Location !== undefined) module002NextDraft.meetingInfo.location = module002Location;
        if (module002DateTime) {
          module002NextDraft.meetingInfo.date = [
            module002DateTime[1],
            module002DateTime[2].padStart(2, "0"),
            module002DateTime[3].padStart(2, "0"),
          ].join("-");
          module002NextDraft.meetingInfo.time = module002DateTime[4]?.trim() ?? "";
        }
        const module002PeopleByName = new Map(
          module002Config.people
            .filter((module002Person) => module002Person.branchId === module002Draft.branchId)
            .map((module002Person) => [module002Person.name, module002Person.id]),
        );
        const module002ParsePeopleLine = (module002Label) => {
          const module002Names = module002Content.text
            .match(new RegExp(`${module002Label}：([^\\n]*)`))?.[1]
            ?.split(/[、,，]/)
            .map((module002Name) => module002Name.trim())
            .filter((module002Name) => module002Name && module002Name !== "无") ?? [];
          return module002Names
            .map((module002Name) => module002PeopleByName.get(module002Name))
            .filter(Boolean);
        };
        module002NextDraft.meetingInfo.attendeePersonIds = module002ParsePeopleLine("参加人员");
        module002NextDraft.meetingInfo.absentPersonIds = module002ParsePeopleLine("缺席人员");
        const module002Observers = module002Content.text.match(/列席人员：([^\n]*)/)?.[1]?.trim();
        if (module002Observers !== undefined) {
          module002NextDraft.meetingInfo.observers = module002Observers === "无" ? "" : module002Observers;
        }
        const module002HostName = module002Content.text.match(/主持人：([^\s\n]*)/)?.[1]?.trim();
        const module002RecorderName = module002Content.text.match(/记录人：([^\s\n]*)/)?.[1]?.trim();
        if (module002PeopleByName.has(module002HostName)) module002NextDraft.meetingInfo.hostPersonId = module002PeopleByName.get(module002HostName);
        if (module002PeopleByName.has(module002RecorderName)) module002NextDraft.meetingInfo.recorderPersonId = module002PeopleByName.get(module002RecorderName);
      }
      if (module002Block.moduleType === "hostOpening") {
        module002NextDraft.hostOpening = module002Content.text
          .replace(/^[^：:]*[：:]/, "")
          .trim();
      }
      if (module002Block.moduleType === "groupSpeeches") {
        const module002PersonByName = new Map(
          module002Config.people.map((module002Person) => [
            module002Person.name,
            module002Person.id,
          ]),
        );
        module002Content.text.split("\n").forEach((module002Line) => {
          const module002Match = module002Line.match(/^([^：:]+)[：:](.*)$/);
          const module002PersonId = module002PersonByName.get(
            module002Match?.[1]?.trim(),
          );
          if (module002PersonId) {
            module002NextDraft.speeches[module002PersonId] =
              module002Match[2].trim();
          }
        });
      }
      return module002NextDraft;
    });
  },

  /** 一次性回填通过整体验证的 AI 结果。 */
  module002ApplyAiResult(module002Result) {
    module002Get().module002UpdateDraft((module002Draft) =>
      module002ClearBlockOverrides(
        {
          ...module002Draft,
          speeches: Object.fromEntries(
            module002Result.speeches.map((module002Speech) => [
              module002Speech.personId,
              module002Speech.content,
            ]),
          ),
        },
        ["groupSpeeches"],
      ),
    );
  },

  /** 新建自定义人物字段。 */
  module002AddPersonField(module002Label, module002Type) {
    module002Get().module002UpdateConfig((module002Config) => ({
      ...module002Config,
      personFields: [
        ...module002Config.personFields,
        {
          id: module002CreateId("person-field"),
          label: module002Label,
          type: module002Type,
          builtIn: false,
          order: module002Config.personFields.length,
        },
      ],
    }));
  },

  /** 删除自定义人物字段，并清除三支部所有人物卡中的对应数据。 */
  module002RemovePersonField(module002FieldId) {
    module002Get().module002UpdateConfig((module002Config) => {
      const module002Field = module002Config.personFields.find(
        (module002Item) => module002Item.id === module002FieldId,
      );
      if (!module002Field || module002Field.builtIn) return module002Config;
      return {
        ...module002Config,
        personFields: module002Config.personFields
          .filter((module002Item) => module002Item.id !== module002FieldId)
          .map((module002Item, module002Order) => ({
            ...module002Item,
            order: module002Order,
          })),
        people: module002Config.people.map((module002Person) => {
          const module002Values = { ...module002Person.values };
          delete module002Values[module002FieldId];
          return { ...module002Person, values: module002Values };
        }),
      };
    });
  },

  /** 保存完成后只更新设备状态，不制造新的业务修订。 */
  module002MarkSaved(module002Kind) {
    module002Set({
      ...(module002Kind === "config" ? { module002ConfigDirty: false } : {}),
      ...(module002Kind === "draft" ? { module002DraftDirty: false } : {}),
      module002LastSavedAt: new Date().toISOString(),
    });
  },

  /** 清空当前草稿状态，由调用方负责先删除磁盘文件。 */
  module002ClearDraft() {
    module002Set({ module002Draft: null, module002DraftDirty: false });
  },

  /** 让完成检查定位到相应右侧步骤或正文。 */
  module002FocusSection(module002ActiveSection) {
    module002Set({ module002ActiveSection });
  },
}));
