"use client";

import { ChevronDown, CircleAlert, FileText, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  module002BuildAiDocumentBody,
  module002BuildCommitteeAiDocumentBody,
  module002GetExportChecks,
  module002GetOrderedSpeakers,
} from "./domain/module002Document";
import {
  module002GetCommitteeMembers,
  module002GetCommitteePeople,
  module002GetCommitteeSourceRecords,
  module002IsCommitteeMeeting,
} from "./domain/module002CommitteeMeeting";
import {
  module002GetPersonPromptIdentifier,
  module002GetCommitteeProtocolText,
  module002GetPromptIdentityField,
  module002GetStandardProtocolText,
  module002RenderPrompt,
  module002SerializePersonCards,
  module002ValidateAiResult,
  module002ValidateCommitteeAiResult,
  module002ValidateCommitteePrompt,
  module002ValidatePrompt,
  module002ValidateSingleSpeechResult,
} from "./ai/module002Prompt";
import { module002LoadModels, module002RequestAi } from "./ai/module002AiClient";
import { module002CreateDraftFingerprint } from "./export/module002Docx";
import { module002SaveExportBundle } from "./export/module002ExportBundle";
import Module002ExportTemplateDialog from "./export/module002ExportTemplateDialog";
import { module002ReleaseOcrWorker } from "./parser/module002FileParser";
import { useModule002Store } from "./state/module002Store";
import {
  platformEnsureWorkspacePermission,
  platformGetWorkspaceCapability,
  platformOpenModuleWorkspace,
  platformReadRememberedWorkspace,
} from "../../../_platform/workspace/platformWorkspace";
import { platformGetModuleWorkspaceFolderName } from "../../../_platform/platformModuleCatalog";
import {
  module002DeleteCurrentDraft,
  module002LoadCurrentDraft,
  module002OpenOrCreateWorkspace,
  module002SaveConfig,
  module002SaveCurrentDraft,
} from "./workspace/module002Repository";
import Module002Dialog from "./components/module002Dialog";
import Module002Editor from "./editor/module002Editor";
import Module002FormatDialog from "./components/module002FormatDialog";
import Module002PeopleDialog from "./people/module002PeopleDialog";
import Module002RightPanel from "./components/module002RightPanel";
import Module002TemplateDialog from "./templates/module002TemplateDialog";
import Module002TemplatePicker from "./components/module002TemplatePicker";
import Module002WorkspaceEntry from "./components/module002WorkspaceEntry";

const module002RightWidthStorageKey = "kunstools.module002.rightWidth";

/** 仅从设备偏好读取非权威的右栏宽度。 */
function module002ReadInitialRightWidth() {
  if (typeof window === "undefined") return 390;
  const module002StoredWidth = Number(
    window.localStorage.getItem(module002RightWidthStorageKey),
  );
  return module002StoredWidth >= 320 && module002StoredWidth <= 720
    ? module002StoredWidth
    : 390;
}

/** 提供模块 002 的工作区生命周期、双栏界面和核心业务命令。 */
export default function Module002App() {
  const module002Store = useModule002Store();
  const {
    module002WorkspaceHandle,
    module002Config,
    module002Draft,
    module002WorkspaceStatus,
    module002WorkspaceMessage,
    module002ConfigDirty,
    module002DraftDirty,
    module002ActiveSection,
  } = module002Store;
  const [module002RightCollapsed, setModule002RightCollapsed] = useState(false);
  const [module002RightWidth, setModule002RightWidth] = useState(
    module002ReadInitialRightWidth,
  );
  const [module002TemplatePickerOpen, setModule002TemplatePickerOpen] = useState(false);
  const [module002TemplateDialogOpen, setModule002TemplateDialogOpen] = useState(false);
  const [module002PeopleDialogOpen, setModule002PeopleDialogOpen] = useState(false);
  const [module002FormatDialogOpen, setModule002FormatDialogOpen] = useState(false);
  const [module002ExportTemplateDialogOpen, setModule002ExportTemplateDialogOpen] = useState(false);
  const [module002SwitchDialogOpen, setModule002SwitchDialogOpen] = useState(false);
  const [module002RevisePersonId, setModule002RevisePersonId] = useState(null);
  const [module002ReviseInstruction, setModule002ReviseInstruction] = useState("");
  const [module002ReviseCandidate, setModule002ReviseCandidate] = useState(null);
  const [module002SpeechBackup, setModule002SpeechBackup] = useState(null);
  const [module002FormatBackup, setModule002FormatBackup] = useState(null);
  const [module002Models, setModule002Models] = useState([
    "deepseek-v4-flash",
    "deepseek-v4-pro",
  ]);
  const [module002AiBusy, setModule002AiBusy] = useState(false);
  const [module002ExportBusy, setModule002ExportBusy] = useState(false);
  const [module002Notice, setModule002Notice] = useState(null);
  const [module002ExportState, setModule002ExportState] = useState("notExported");
  const module002HasInitialized = useRef(false);
  const module002ResizeStart = useRef(null);

  /** 打开已授权目录并只采用通过 schema 校验的配置和草稿。 */
  const module002OpenWorkspace = useCallback(async (module002RootHandle) => {
    module002Store.module002SetWorkspaceStatus("opening", "正在校验工作区");
    try {
      const module002FolderName = platformGetModuleWorkspaceFolderName("002");
      if (!module002FolderName) {
        throw new Error("002 shared workspace folder is not configured");
      }
      const module002Handle = await platformOpenModuleWorkspace(
        module002RootHandle,
        module002FolderName,
      );
      const module002Opened = await module002OpenOrCreateWorkspace(module002Handle);
      const module002LoadedDraft = await module002LoadCurrentDraft(module002Handle);
      module002Store.module002SetWorkspace(
        module002Handle,
        module002Opened.config,
        module002LoadedDraft.draft,
        module002LoadedDraft.recovered
          ? "已从安全恢复文件恢复当前草稿"
          : module002Opened.recovered
            ? "已从安全恢复文件恢复配置"
            : "",
      );
    } catch (module002Error) {
      module002Store.module002SetWorkspaceStatus("error", module002Error.message || "工作区无法打开");
    }
  }, [module002Store]);

  useEffect(() => {
    if (module002HasInitialized.current) return;
    module002HasInitialized.current = true;
    /** 尝试恢复目录句柄，但不会在非用户操作中弹权限请求。 */
    async function module002RestoreRemembered() {
      const module002Capability = platformGetWorkspaceCapability();
      if (!module002Capability.supported) {
        module002Store.module002SetWorkspaceStatus(
          "unsupported",
          module002Capability.reason,
        );
        return;
      }

      try {
        const module002Remembered = await platformReadRememberedWorkspace();
        if (!module002Remembered?.handle) {
          module002Store.module002SetWorkspaceStatus(
            "needsSelection",
            "请返回主页选择本地工作区。",
          );
          return;
        }
        if (await platformEnsureWorkspacePermission(module002Remembered.handle, false)) {
          await module002OpenWorkspace(module002Remembered.handle);
        } else {
          module002Store.module002SetWorkspaceStatus(
            "permissionLost",
            "本地工作区需要重新授权，请返回主页完成授权。",
          );
        }
      } catch (module002RestoreError) {
        module002Store.module002SetWorkspaceStatus(
          "error",
          module002RestoreError?.message || "本地工作区无法打开。",
        );
      }
    }
    module002RestoreRemembered();
  }, [module002OpenWorkspace, module002Store]);

  useEffect(() => () => {
    module002ReleaseOcrWorker().catch(() => {});
  }, []);

  useEffect(() => {
    if (!module002WorkspaceHandle || !module002ConfigDirty || !module002Config) return undefined;
    const module002Revision = module002Config.revision;
    const module002Timer = window.setTimeout(async () => {
      try {
        await module002SaveConfig(module002WorkspaceHandle, module002Config, false);
        if (useModule002Store.getState().module002Config?.revision === module002Revision) {
          module002Store.module002MarkSaved("config");
        }
      } catch (module002Error) {
        setModule002Notice({ type: "error", text: `配置保存失败：${module002Error.message}` });
      }
    }, 700);
    return () => window.clearTimeout(module002Timer);
  }, [module002Config, module002ConfigDirty, module002Store, module002WorkspaceHandle]);

  useEffect(() => {
    if (!module002WorkspaceHandle || !module002DraftDirty || !module002Draft) return undefined;
    const module002Revision = module002Draft.revision;
    const module002Timer = window.setTimeout(async () => {
      try {
        await module002SaveCurrentDraft(module002WorkspaceHandle, module002Draft);
        if (useModule002Store.getState().module002Draft?.revision === module002Revision) {
          module002Store.module002MarkSaved("draft");
        }
      } catch (module002Error) {
        setModule002Notice({ type: "error", text: `草稿保存失败：${module002Error.message}` });
      }
    }, 500);
    return () => window.clearTimeout(module002Timer);
  }, [module002Draft, module002DraftDirty, module002Store, module002WorkspaceHandle]);

  useEffect(() => {
    if (!module002Draft) {
      return undefined;
    }
    let module002Active = true;
    module002CreateDraftFingerprint(module002Draft).then((module002Fingerprint) => {
      if (module002Active) {
        setModule002ExportState(
          !module002Draft.exportedFingerprint
            ? "notExported"
            : module002Draft.exportedFingerprint === module002Fingerprint
              ? "exported"
              : "changed",
        );
      }
    });
    return () => { module002Active = false; };
  }, [module002Draft]);

  useEffect(() => {
    if (module002WorkspaceStatus !== "ready") return;
    module002LoadModels()
      .then((module002Result) => {
        if (module002Result.models?.length) setModule002Models(module002Result.models);
        if (!module002Result.configured) {
          setModule002Notice({ type: "info", text: "服务端尚未配置 DeepSeek API Key；编辑和导出仍可正常使用。" });
        }
      })
      .catch(() => {});
  }, [module002WorkspaceStatus]);

  /** 在一次请求中按人物卡序号生成全部普通交流发言。 */
  async function module002GenerateAll() {
    if (module002IsCommitteeMeeting(module002Draft)) {
      await module002GenerateCommitteeMinutes();
      return;
    }
    const module002PromptErrors = module002ValidatePrompt(module002Draft.prompt);
    if (module002PromptErrors.length) {
      setModule002Notice({ type: "error", text: module002PromptErrors[0] });
      module002Store.module002FocusSection("speakers");
      return;
    }
    const module002Speakers = module002GetOrderedSpeakers(module002Draft, module002Config);
    const module002IdentityField = module002GetPromptIdentityField(
      module002Draft.prompt,
    );
    const module002RenderedPrompt = module002RenderPrompt(module002Draft.prompt, {
      CURRENT_DOCUMENT_BODY: module002BuildAiDocumentBody(module002Draft, module002Config),
      PERSON_CARDS: module002SerializePersonCards(
        module002Speakers,
        module002Config.personFields,
        module002IdentityField,
      ),
    });
    setModule002AiBusy(true);
    setModule002Notice(null);
    try {
      let module002Response = await module002RequestAi({ action: "generate", model: module002Config.settings.preferredModel, prompt: module002RenderedPrompt });
      let module002Raw;
      try {
        module002Raw = JSON.parse(module002Response.content);
        module002ValidateAiResult({
          module002RawResult: module002Raw,
          module002Speakers,
          module002IdentityField,
        });
      } catch (module002ProtocolError) {
        module002Response = await module002RequestAi({
          action: "repair",
          model: module002Config.settings.preferredModel,
          prompt: `只修复下面返回内容的 JSON 格式和固定字段，不改写任何发言内容。\n${module002GetStandardProtocolText(module002IdentityField)}\n\n原始返回：\n${module002Response.content}`,
        });
        module002Raw = JSON.parse(module002Response.content);
      }
      const module002Validated = module002ValidateAiResult({
        module002RawResult: module002Raw,
        module002Speakers,
        module002IdentityField,
      });
      module002Store.module002ApplyAiResult(module002Validated);
      setModule002Notice({ type: "success", text: "全部发言已生成并通过人员协议校验" });
    } catch (module002Error) {
      setModule002Notice({ type: "error", text: module002Error.message || "发言生成失败，现有内容未改变" });
    } finally {
      setModule002AiBusy(false);
    }
  }

  /** 按单份材料生成支委会书记双段发言和委员发言，失败时绝不覆盖已有正文。 */
  async function module002GenerateCommitteeMinutes() {
    const module002PromptErrors = module002ValidateCommitteePrompt(
      module002Draft.prompt,
    );
    if (module002PromptErrors.length) {
      setModule002Notice({ type: "error", text: module002PromptErrors[0] });
      module002Store.module002FocusSection("speakers");
      return;
    }
    const module002CommitteePeople = module002GetCommitteePeople(
      module002Draft,
      module002Config,
    );
    const module002CommitteeMembers = module002GetCommitteeMembers(
      module002Draft,
      module002Config,
    );
    const module002Records = module002GetCommitteeSourceRecords(module002Draft);
    const module002IdentityField = module002GetPromptIdentityField(
      module002Draft.prompt,
    );
    setModule002AiBusy(true);
    setModule002Notice(null);
    try {
      const module002Results = [];
      for (const module002Record of module002Records) {
        const module002RenderedPrompt = module002RenderPrompt(module002Draft.prompt, {
          CURRENT_DOCUMENT_BODY: module002BuildCommitteeAiDocumentBody(
            module002Draft,
            module002Record,
          ),
          PERSON_CARDS: module002SerializePersonCards(
            module002CommitteePeople,
            module002Config.personFields,
            module002IdentityField,
          ),
        });
        let module002Response = await module002RequestAi({
          action: "generate",
          model: module002Config.settings.preferredModel,
          prompt: module002RenderedPrompt,
        });
        let module002Raw;
        try {
          module002Raw = JSON.parse(module002Response.content);
          module002ValidateCommitteeAiResult({
            module002RawResult: module002Raw,
            module002CommitteeMembers,
            module002IdentityField,
          });
        } catch (module002ProtocolError) {
          module002Response = await module002RequestAi({
            action: "repair",
            model: module002Config.settings.preferredModel,
            prompt: `只修复下面返回内容的 JSON 格式和固定字段，不改写任何发言内容。\n${module002GetCommitteeProtocolText(module002IdentityField)}\n\n原始返回：\n${module002Response.content}`,
          });
          module002Raw = JSON.parse(module002Response.content);
        }
        const module002Validated = module002ValidateCommitteeAiResult({
          module002RawResult: module002Raw,
          module002CommitteeMembers,
          module002IdentityField,
        });
        module002Results.push({
          sourceId: module002Record.source.id,
          ...module002Validated,
        });
      }
      module002Store.module002ApplyCommitteeAiResults(module002Results);
      setModule002Notice({
        type: "success",
        text: module002Results.length
          ? "支委会会议详细记录已按材料生成并通过人员协议校验"
          : "支委会固定结构已生成，可继续补充议题材料",
      });
    } catch (module002Error) {
      setModule002Notice({
        type: "error",
        text: module002Error.message || "支委会发言生成失败，现有内容未改变",
      });
    } finally {
      setModule002AiBusy(false);
    }
  }

  /** 经用户确认切换类型，并由状态中心保留本次会议的基本信息和材料。 */
  function module002ChangeMeetingType(module002MeetingType) {
    if (module002MeetingType === module002Draft.meetingInfo.meetingType) return;
    if (
      !window.confirm(
        "切换会议类型会按新模板重建正文，当前基本信息、人物和材料会保留，已有正文会被替换。是否继续？",
      )
    ) {
      return;
    }
    try {
      module002Store.module002ChangeMeetingType(module002MeetingType);
      setModule002Notice({ type: "success", text: "会议类型已切换，已按新模板等待生成正文" });
    } catch (module002Error) {
      setModule002Notice({ type: "error", text: module002Error.message || "会议类型切换失败" });
    }
  }

  /** 只请求修改目标人物发言，并在用户确认前保留原文。 */
  async function module002RequestPersonRevision() {
    const module002Person = module002Config.people.find(
      (module002Item) => module002Item.id === module002RevisePersonId,
    );
    if (!module002Person || !module002ReviseInstruction.trim()) return;
    const module002IdentityField = module002GetPromptIdentityField(
      module002Draft.prompt,
    );
    const module002Protocol = `请仅输出 json：{"${module002IdentityField}":"${module002GetPersonPromptIdentifier(module002Person, module002IdentityField)}","name":"${module002Person.name}","content":"修改后的完整发言"}`;
    const module002Prompt = [
      module002Protocol,
      "当前文档正文：",
      module002BuildAiDocumentBody(module002Draft, module002Config),
      "目标人物卡：",
      module002SerializePersonCards(
        [module002Person],
        module002Config.personFields,
        module002IdentityField,
      ),
      `目标人物当前发言：${module002Draft.speeches[module002Person.id] ?? ""}`,
      `本次修改要求：${module002ReviseInstruction}`,
    ].join("\n\n");
    setModule002AiBusy(true);
    try {
      const module002Response = await module002RequestAi({
        action: "revise",
        model: module002Config.settings.preferredModel,
        prompt: module002Prompt,
      });
      const module002Validated = module002ValidateSingleSpeechResult(
        JSON.parse(module002Response.content),
        module002Person,
        module002IdentityField,
      );
      setModule002ReviseCandidate(module002Validated);
    } catch (module002Error) {
      setModule002Notice({ type: "error", text: module002Error.message || "单人发言修改失败" });
    } finally {
      setModule002AiBusy(false);
    }
  }

  /** 用户确认对比结果后替换，并保存一次可恢复的旧发言。 */
  function module002ConfirmPersonRevision() {
    const module002OldContent =
      module002Draft.speeches[module002ReviseCandidate.personId] ?? "";
    setModule002SpeechBackup({
      personId: module002ReviseCandidate.personId,
      content: module002OldContent,
    });
    module002Store.module002UpdateDraft((module002NextDraft) => ({
      ...module002NextDraft,
      speeches: {
        ...module002NextDraft.speeches,
        [module002ReviseCandidate.personId]: module002ReviseCandidate.content,
      },
      editorBlocks: module002NextDraft.editorBlocks.filter(
        (module002Block) => module002Block.moduleType !== "groupSpeeches",
      ),
    }));
    setModule002ReviseCandidate(null);
    setModule002RevisePersonId(null);
    setModule002ReviseInstruction("");
    setModule002Notice({ type: "success", text: "已替换该人物发言，可使用下方撤销操作恢复" });
  }

  /** 通过检查后生成 DOCX，并记录此次导出内容指纹。 */
  async function module002ExportWord(module002Options = {}) {
    const module002Checks = module002GetExportChecks(module002Draft, module002Config);
    if (module002Checks.length) {
      setModule002Notice({ type: "error", text: module002Checks[0].label });
      return false;
    }
    setModule002ExportBusy(true);
    try {
      const module002Exported = await module002SaveExportBundle({
        module002Draft,
        module002Config,
        module002WorkspaceHandle,
        module002Options,
      });
      const module002Fingerprint = module002Exported.fingerprint;
      module002Store.module002UpdateDraft((module002NextDraft) => ({ ...module002NextDraft, exportedFingerprint: module002Fingerprint }));
      setModule002Notice({
        type: "success",
        text: module002Exported.fileNames.length > 1
          ? "会议记录及勾选附件已保存；当前草稿继续保留"
          : "Word 已保存；当前草稿继续保留",
      });
      return true;
    } catch (module002Error) {
      if (module002Error?.name !== "AbortError") setModule002Notice({ type: "error", text: module002Error.message || "Word 导出失败" });
      return false;
    } finally {
      setModule002ExportBusy(false);
    }
  }

  /** 用户确认后删除唯一草稿并打开模板选择。 */
  async function module002DiscardAndChooseTemplate() {
    await module002DeleteCurrentDraft(module002WorkspaceHandle);
    module002Store.module002ClearDraft();
    setModule002FormatBackup(null);
    setModule002SwitchDialogOpen(false);
    setModule002TemplatePickerOpen(true);
  }

  /** 经确认把格式预览应用到当前草稿，并保留一次可撤销快照。 */
  function module002ApplyFormatToCurrentDraft(module002Format) {
    if (!window.confirm("将新全局格式应用到当前草稿吗？此操作会记录为一次草稿修改。")) {
      return;
    }
    setModule002FormatBackup(structuredClone(module002Draft.documentFormatSnapshot));
    module002Store.module002UpdateDraft((module002NextDraft) => ({
      ...module002NextDraft,
      documentFormatSnapshot: structuredClone(module002Format),
    }));
    setModule002Notice({ type: "success", text: "新格式已应用到当前草稿，可撤销一次" });
  }

  /** 开始拖动分隔条并限制配置区不会挤没正文。 */
  function module002StartResize(module002Event) {
    module002ResizeStart.current = { x: module002Event.clientX, width: module002RightWidth };
    const module002HandleMove = (module002MoveEvent) => {
      const module002NextWidth = Math.min(720, Math.max(320, module002ResizeStart.current.width + module002ResizeStart.current.x - module002MoveEvent.clientX));
      module002ResizeStart.current.nextWidth = module002NextWidth;
      setModule002RightWidth(module002NextWidth);
    };
    const module002HandleUp = () => {
      window.localStorage.setItem(
        module002RightWidthStorageKey,
        String(module002ResizeStart.current.nextWidth ?? module002ResizeStart.current.width),
      );
      window.removeEventListener("pointermove", module002HandleMove);
      window.removeEventListener("pointerup", module002HandleUp);
    };
    window.addEventListener("pointermove", module002HandleMove);
    window.addEventListener("pointerup", module002HandleUp);
  }

  const module002CurrentBranch = useMemo(() => module002Config?.branches.find((item) => item.id === module002Draft?.branchId), [module002Config, module002Draft]);

  if (module002WorkspaceStatus !== "ready" || !module002Config) {
    return (
      <Module002WorkspaceEntry
        module002Message={module002WorkspaceMessage}
        module002Status={module002WorkspaceStatus}
      />
    );
  }

  return (
    <div className="module002App" style={{ "--module002RightWidth": `${module002RightWidth}px` }}>
      {module002Notice ? <div className={`module002Notice is-${module002Notice.type}`} role="status"><CircleAlert size={15} />{module002Notice.text}<button aria-label="关闭提示" onClick={() => setModule002Notice(null)} type="button">×</button></div> : null}
      <div className="module002MainPane">
        {module002Draft ? <>
          <div className="module002DocumentHeader">
            <div className="module002DocumentHeaderActions"><button onClick={() => setModule002SwitchDialogOpen(true)} type="button"><span>{module002CurrentBranch?.name} / {module002Draft.templateSnapshot.name}</span><ChevronDown size={14} />更换</button><button onClick={() => setModule002SwitchDialogOpen(true)} type="button">开始新会议</button></div>
            <span className={`module002SaveState is-${module002ExportState}`}>{module002DraftDirty ? "正在保存" : module002ExportState === "changed" ? "内容已变更，需要重新导出" : module002ExportState === "exported" ? "已导出" : "草稿已自动保存"}</span>
          </div>
          <Module002Editor module002ActiveSection={module002ActiveSection} module002Config={module002Config} module002Draft={module002Draft} module002OnFocusSection={module002Store.module002FocusSection} module002OnUpdateBlock={module002Store.module002UpdateEditorBlock} />
        </> : <div className="module002EmptyEditor"><button onClick={() => setModule002TemplatePickerOpen(true)} type="button">选择党支部模板</button></div>}
      </div>
      {module002Draft ? <>
        {!module002RightCollapsed ? <div aria-label="拖动调整配置区宽度" className="module002ResizeHandle" onPointerDown={module002StartResize} role="separator" tabIndex={0} /> : null}
        <Module002RightPanel
          module002ActiveSection={module002ActiveSection}
          module002AiBusy={module002AiBusy}
          module002Collapsed={module002RightCollapsed}
          module002Config={module002Config}
          module002Draft={module002Draft}
          module002ExportBusy={module002ExportBusy}
          module002Models={module002Models}
          module002OnCollapse={() => setModule002RightCollapsed((value) => !value)}
          module002OnExport={module002ExportWord}
          module002OnFocusSection={module002Store.module002FocusSection}
          module002OnGenerate={module002GenerateAll}
          module002OnChangeMeetingType={module002ChangeMeetingType}
          module002OnMeetingInfo={module002Store.module002UpdateMeetingInfo}
          module002OnOpenFormat={() => setModule002FormatDialogOpen(true)}
          module002OnOpenExportTemplates={() => setModule002ExportTemplateDialogOpen(true)}
          module002OnOpenPeople={() => setModule002PeopleDialogOpen(true)}
          module002OnOpenTemplates={() => setModule002TemplateDialogOpen(true)}
          module002OnRevisePerson={(module002PersonId) => {
            setModule002RevisePersonId(module002PersonId);
            setModule002ReviseCandidate(null);
            setModule002ReviseInstruction("");
          }}
          module002OnSetSpeakers={module002Store.module002SetSpeakers}
          module002OnSetTopics={module002Store.module002SetTopics}
          module002OnUpdateConfig={module002Store.module002UpdateConfig}
          module002OnUpdateDraft={module002Store.module002UpdateDraft}
        />
      </> : <aside className="module002SetupRail"><button onClick={() => setModule002FormatDialogOpen(true)} type="button"><FileText size={15} />文档格式</button><button onClick={() => setModule002TemplateDialogOpen(true)} type="button">配置党支部模板</button><button onClick={() => setModule002PeopleDialogOpen(true)} type="button">人物卡</button></aside>}
      {module002RightCollapsed && module002Draft ? <button aria-label="展开配置区" className="module002FloatingExpand" onClick={() => setModule002RightCollapsed(false)} type="button"><PanelRightOpen size={18} /></button> : null}

      <Module002TemplatePicker module002Config={module002Config} module002OnChoose={(module002TemplateId) => { module002Store.module002StartDraft(module002TemplateId); setModule002TemplatePickerOpen(false); }} module002OnClose={() => setModule002TemplatePickerOpen(false)} module002Open={module002TemplatePickerOpen} />
      {module002TemplateDialogOpen ? <Module002TemplateDialog module002Config={module002Config} module002Draft={module002Draft} module002OnChange={module002Store.module002UpdateConfig} module002OnClose={() => setModule002TemplateDialogOpen(false)} module002Open /> : null}
      {module002PeopleDialogOpen ? <Module002PeopleDialog module002Config={module002Config} module002OnAddField={module002Store.module002AddPersonField} module002OnChange={module002Store.module002UpdateConfig} module002OnClose={() => setModule002PeopleDialogOpen(false)} module002OnRemoveField={module002Store.module002RemovePersonField} module002Open /> : null}
      {module002FormatDialogOpen ? <Module002FormatDialog module002Config={module002Config} module002Draft={module002Draft} module002OnApplyToDraft={module002ApplyFormatToCurrentDraft} module002OnChangeConfig={module002Store.module002UpdateConfig} module002OnClose={() => setModule002FormatDialogOpen(false)} module002Open /> : null}
      {module002ExportTemplateDialogOpen ? <Module002ExportTemplateDialog module002Config={module002Config} module002OnChange={module002Store.module002UpdateConfig} module002OnClose={() => setModule002ExportTemplateDialogOpen(false)} module002Open module002WorkspaceHandle={module002WorkspaceHandle} /> : null}
      <Module002Dialog module002Description="更换模板会结束当前草稿，做出选择前不会切换。" module002Footer={<><button className="module002SecondaryButton" disabled={module002ExportBusy} onClick={async () => { if (await module002ExportWord()) await module002DiscardAndChooseTemplate(); }} type="button">先导出Word</button><button className="module002DangerButton" onClick={module002DiscardAndChooseTemplate} type="button">舍弃草稿</button><button className="module002SecondaryButton" onClick={() => setModule002SwitchDialogOpen(false)} type="button">取消操作</button></>} module002OnClose={() => setModule002SwitchDialogOpen(false)} module002Open={module002SwitchDialogOpen} module002Title="更换模板或开始新会议" />
      <Module002Dialog
        module002Description="只发送目标人物卡、当前发言、当前正文和本次修改要求。"
        module002Footer={module002ReviseCandidate ? <><button className="module002SecondaryButton" onClick={() => setModule002ReviseCandidate(null)} type="button">返回修改要求</button><button className="module002PrimaryButton" onClick={module002ConfirmPersonRevision} type="button">确认替换</button></> : <button className="module002PrimaryButton" disabled={!module002ReviseInstruction.trim() || module002AiBusy} onClick={module002RequestPersonRevision} type="button">生成修改稿</button>}
        module002OnClose={() => { setModule002RevisePersonId(null); setModule002ReviseCandidate(null); }}
        module002Open={Boolean(module002RevisePersonId)}
        module002Title="修改单人发言"
      >
        {module002RevisePersonId ? module002ReviseCandidate ? <div className="module002RevisionCompare"><section><h3>原文</h3><p>{module002Draft.speeches[module002RevisePersonId]}</p></section><section><h3>修改稿</h3><p>{module002ReviseCandidate.content}</p></section></div> : <><p className="module002RevisionOriginal">当前发言：{module002Draft.speeches[module002RevisePersonId]}</p><label className="module002RevisionInstruction">修改要求<textarea onChange={(event) => setModule002ReviseInstruction(event.target.value)} rows="5" value={module002ReviseInstruction} /></label></> : null}
      </Module002Dialog>
      {module002SpeechBackup ? <button className="module002UndoRevision" onClick={() => {
        module002Store.module002UpdateDraft((module002NextDraft) => ({ ...module002NextDraft, speeches: { ...module002NextDraft.speeches, [module002SpeechBackup.personId]: module002SpeechBackup.content }, editorBlocks: module002NextDraft.editorBlocks.filter((module002Block) => module002Block.moduleType !== "groupSpeeches") }));
        setModule002SpeechBackup(null);
      }} type="button">撤销上次单人发言替换</button> : null}
      {module002FormatBackup ? <button className="module002UndoFormat" onClick={() => {
        module002Store.module002UpdateDraft((module002NextDraft) => ({
          ...module002NextDraft,
          documentFormatSnapshot: structuredClone(module002FormatBackup),
        }));
        setModule002FormatBackup(null);
      }} type="button">撤销上次当前草稿格式应用</button> : null}
    </div>
  );
}
