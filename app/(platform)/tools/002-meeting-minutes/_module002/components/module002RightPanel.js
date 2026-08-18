"use client";

import {
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  FilePlus2,
  FileText,
  LoaderCircle,
  PanelRightClose,
  Settings2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { module002CreateId } from "../domain/module002Factories";
import {
  module002BuildAiDocumentBody,
  module002GetBranchPeople,
  module002GetExportChecks,
  module002GetGenerationChecks,
  module002GetOrderedSpeakers,
} from "../domain/module002Document";
import { module002GetSupportedFileType } from "../parser/module002CandidateParagraphs";
import {
  module002MaximumFileCount,
  module002ParseSourceFile,
} from "../parser/module002FileParser";
import {
  module002GetPromptIdentityField,
  module002RequiredPromptVariables,
  module002SerializePersonCards,
  module002StandardProtocolText,
} from "../ai/module002Prompt";

/** 返回移动一个列表项后的新数组。 */
function module002MoveItem(module002Items, module002From, module002To) {
  const module002Next = [...module002Items];
  const [module002Moved] = module002Next.splice(module002From, 1);
  module002Next.splice(module002To, 0, module002Moved);
  return module002Next;
}

/** 在议题单一数据源中替换一个材料状态。 */
function module002PatchTopicSource(
  module002Topics,
  module002TopicId,
  module002SourceId,
  module002Patch,
) {
  return module002Topics.map((module002Topic) =>
    module002Topic.id === module002TopicId
      ? {
          ...module002Topic,
          sources: module002Topic.sources.map((module002Source) =>
            module002Source.id === module002SourceId
              ? { ...module002Source, ...module002Patch }
              : module002Source,
          ),
        }
      : module002Topic,
  );
}

/** 渲染右侧单个可折叠步骤。 */
function Module002Step({
  module002Id,
  module002Title,
  module002Open,
  module002OnToggle,
  children: module002Children,
  module002Badge,
  module002Active,
  module002OnActivate,
}) {
  /** 标题按钮自行处理激活，避免 focus 自动展开与 click 折叠在同一轮相互抵消。 */
  function module002HandleFocus(event) {
    if (!event.target.closest(".module002StepHeader")) module002OnActivate();
  }

  /** 先切换步骤，再同步当前业务区；由 activeSection 兜底展开跨区跳转。 */
  function module002HandleHeaderClick() {
    module002OnToggle();
    module002OnActivate();
  }

  return (
    <section className={`module002Step ${module002Active ? "isActive" : ""}`} id={`module002-${module002Id}`} onFocusCapture={module002HandleFocus}>
      <button aria-expanded={module002Open} className="module002StepHeader" onClick={module002HandleHeaderClick} type="button">
        <span>{module002Title}</span>{module002Badge ? <small>{module002Badge}</small> : null}<ChevronDown className={module002Open ? "isOpen" : ""} size={16} />
      </button>
      {module002Open ? <div className="module002StepBody">{module002Children}</div> : null}
    </section>
  );
}

/** 渲染当前会议的配置步骤、材料解析和固定底部操作。 */
export default function Module002RightPanel({
  module002Config,
  module002Draft,
  module002Collapsed,
  module002OnCollapse,
  module002OnOpenFormat,
  module002OnOpenTemplates,
  module002OnOpenPeople,
  module002OnMeetingInfo,
  module002OnSetTopics,
  module002OnSetSpeakers,
  module002OnUpdateDraft,
  module002OnUpdateConfig,
  module002OnGenerate,
  module002OnExport,
  module002OnRevisePerson,
  module002Models,
  module002AiBusy,
  module002ExportBusy,
  module002ActiveSection,
  module002OnFocusSection,
}) {
  const [module002OpenSteps, setModule002OpenSteps] = useState(new Set(["meetingInfo", "topics"]));
  const [module002ParsingCount, setModule002ParsingCount] = useState(0);
  const [module002ParseProgress, setModule002ParseProgress] = useState(new Map());
  const module002AbortControllers = useRef(new Map());
  const module002RemovedSourceIds = useRef(new Set());
  const module002BranchPeople = useMemo(() => module002GetBranchPeople(module002Config, module002Draft.branchId), [module002Config, module002Draft.branchId]);
  const module002OrderedSpeakers = useMemo(() => module002GetOrderedSpeakers(module002Draft, module002Config), [module002Config, module002Draft]);
  const module002PromptIdentityField = module002GetPromptIdentityField(
    module002Draft.prompt,
  );
  const module002GenerationChecks = module002GetGenerationChecks(module002Draft, module002Config);
  const module002ExportChecks = module002GetExportChecks(module002Draft, module002Config);
  if (!module002Models.includes(module002Config.settings.preferredModel)) {
    const module002ModelCheck = {
      key: "modelUnavailable",
      label: "当前首选模型不在服务端允许列表中",
      target: "speakers",
    };
    module002GenerationChecks.push(module002ModelCheck);
  }
  const module002PersonMap = new Map(module002Config.people.map((item) => [item.id, item]));

  useEffect(() => {
    if (!module002ActiveSection) return;
    const module002SectionMap = { meetingInfo: "meetingInfo", topics: "topics", speakers: "speakers", people: "speakers" };
    const module002Step = module002SectionMap[module002ActiveSection];
    if (module002Step) {
      setModule002OpenSteps((module002Previous) => new Set([...module002Previous, module002Step]));
      window.setTimeout(() => document.getElementById(`module002-${module002Step}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }, [module002ActiveSection]);

  /** 切换右侧步骤并保留其他步骤状态。 */
  function module002ToggleStep(module002Step) {
    setModule002OpenSteps((module002Previous) => {
      const module002Next = new Set(module002Previous);
      if (module002Next.has(module002Step)) module002Next.delete(module002Step);
      else module002Next.add(module002Step);
      return module002Next;
    });
  }

  /** 在组件本地记录逐文件/逐页进度，避免把瞬时解析状态写入权威草稿。 */
  function module002SetSourceProgress(module002SourceId, module002Progress) {
    setModule002ParseProgress((module002Previous) => {
      const module002Next = new Map(module002Previous);
      if (module002Progress) module002Next.set(module002SourceId, module002Progress);
      else module002Next.delete(module002SourceId);
      return module002Next;
    });
  }

  /** 从异步解析快照中清除已被用户移除的材料，防止完成回调把它重新加回。 */
  function module002WithoutRemovedSources(module002Topics) {
    return module002Topics
      .map((module002Topic) => ({
        ...module002Topic,
        sources: module002Topic.sources.filter(
          (module002Source) => !module002RemovedSourceIds.current.has(module002Source.id),
        ),
      }))
      .filter((module002Topic) => module002Topic.sources.length || !module002Topic.firstTopicLocked)
      .map((module002Topic, module002Order) => ({
        ...module002Topic,
        order: module002Order,
        firstTopicLocked: module002Topic.sources.some((module002Source) =>
          module002Source.fileName.includes("第一议题"),
        ),
      }));
  }

  /** 切换参加状态，并自动维护缺席名单和主持/记录有效性。 */
  function module002ToggleAttendee(module002PersonId, module002Checked) {
    const module002Attendees = module002Checked
      ? [...new Set([...module002Draft.meetingInfo.attendeePersonIds, module002PersonId])]
      : module002Draft.meetingInfo.attendeePersonIds.filter((item) => item !== module002PersonId);
    const module002Absentees = module002Checked
      ? module002Draft.meetingInfo.absentPersonIds.filter((item) => item !== module002PersonId)
      : [...new Set([...module002Draft.meetingInfo.absentPersonIds, module002PersonId])];
    module002OnMeetingInfo({
      attendeePersonIds: module002Attendees,
      absentPersonIds: module002Absentees,
      hostPersonId: module002Attendees.includes(module002Draft.meetingInfo.hostPersonId) ? module002Draft.meetingInfo.hostPersonId : null,
      recorderPersonId: module002Attendees.includes(module002Draft.meetingInfo.recorderPersonId) ? module002Draft.meetingInfo.recorderPersonId : null,
    });
    module002OnSetSpeakers(module002Draft.speakerPersonIds.filter((item) => module002Attendees.includes(item)));
  }

  /** 把新文件放入用户点击的指定议题卡，并逐个进行本地解析。 */
  async function module002AddFiles(module002TopicId, module002Files) {
    const module002ExistingCount = module002Draft.topics.reduce((total, topic) => total + topic.sources.length, 0);
    const module002AcceptedFiles = Array.from(module002Files).slice(0, module002MaximumFileCount - module002ExistingCount);
    if (!module002AcceptedFiles.length) return;
    let module002Topics = structuredClone(module002Draft.topics);
    const module002TargetIndex = module002Topics.findIndex((module002Topic) => module002Topic.id === module002TopicId);
    if (module002TargetIndex < 0) return;
    const module002Topic = module002Topics[module002TargetIndex];
    const module002Jobs = [];
    let module002FirstSupportedFileName = null;
    for (const module002File of module002AcceptedFiles) {
      const module002FileType = module002GetSupportedFileType(module002File.name);
      if (!module002FileType) continue;
      const module002Source = { id: module002CreateId("source"), fileName: module002File.name, fileType: module002FileType, status: "pending", selectedText: "", candidates: [], error: null };
      module002Topic.sources.push(module002Source);
      module002FirstSupportedFileName ??= module002File.name;
      module002Jobs.push({ module002File, module002SourceId: module002Source.id });
    }
    const module002FirstTopicTitles = module002TargetIndex === 0
      ? module002Topic.sources
        .filter((module002Source) => module002Source.fileName.includes("第一议题"))
        .map((module002Source) => module002Source.fileName.replace(/\.[^.]+$/, ""))
      : [];
    if (module002FirstTopicTitles.length) {
      module002Topic.title = module002FirstTopicTitles.join("、");
      module002Topic.firstTopicLocked = true;
    } else if (!module002Topic.title.trim() && module002FirstSupportedFileName) {
      module002Topic.title = module002FirstSupportedFileName.replace(/\.[^.]+$/, "");
    }
    module002Topics = module002Topics.map((item, index) => ({ ...item, order: index }));
    module002OnSetTopics(module002Topics);
    for (const module002Job of module002Jobs) {
      const module002Controller = new AbortController();
      module002AbortControllers.current.set(module002Job.module002SourceId, module002Controller);
      setModule002ParsingCount((value) => value + 1);
      module002OnSetTopics(module002Topics.map((topic) => ({ ...topic, sources: topic.sources.map((source) => source.id === module002Job.module002SourceId ? { ...source, status: "parsing" } : source) })));
      try {
        const module002Result = await module002ParseSourceFile({
          module002File: module002Job.module002File,
          module002Signal: module002Controller.signal,
          module002OnProgress: (module002Progress) =>
            module002SetSourceProgress(module002Job.module002SourceId, module002Progress),
        });
        module002Topics = module002Topics.map((topic) => ({ ...topic, sources: topic.sources.map((source) => source.id === module002Job.module002SourceId ? { ...source, status: module002Result.needsSelection ? "needsSelection" : "ready", selectedText: module002Result.selectedText, candidates: module002Result.candidates.length ? module002Result.candidates : module002Result.paragraphs.slice(0, 30), error: null } : source) }));
      } catch (module002Error) {
        module002Topics = module002Topics.map((topic) => ({ ...topic, sources: topic.sources.map((source) => source.id === module002Job.module002SourceId ? { ...source, status: "failed", error: module002Error.name === "AbortError" ? "已取消" : module002Error.message } : source) }));
      } finally {
        module002AbortControllers.current.delete(module002Job.module002SourceId);
        module002SetSourceProgress(module002Job.module002SourceId, null);
        setModule002ParsingCount((value) => Math.max(0, value - 1));
        module002Topics = module002WithoutRemovedSources(module002Topics);
        module002OnSetTopics(module002Topics);
      }
    }
  }

  /** 删除材料并在没有第一议题文件后解除首位锁定。 */
  function module002RemoveSource(module002TopicId, module002SourceId) {
    module002RemovedSourceIds.current.add(module002SourceId);
    module002AbortControllers.current.get(module002SourceId)?.abort();
    let module002Topics = module002Draft.topics.map((topic) => topic.id === module002TopicId ? { ...topic, sources: topic.sources.filter((source) => source.id !== module002SourceId) } : topic);
    module002Topics = module002Topics.filter((topic) => topic.sources.length || !topic.firstTopicLocked).map((topic, index) => ({ ...topic, order: index, firstTopicLocked: topic.sources.some((source) => source.fileName.includes("第一议题")) }));
    module002OnSetTopics(module002Topics);
  }

  /** 用户重新选择本地文件后覆盖该材料的解析结果。 */
  async function module002ReparseSource(
    module002TopicId,
    module002SourceId,
    module002File,
  ) {
    if (!module002File) return;
    const module002FileType = module002GetSupportedFileType(module002File.name);
    if (!module002FileType) return;
    const module002Controller = new AbortController();
    module002AbortControllers.current.set(module002SourceId, module002Controller);
    setModule002ParsingCount((module002Value) => module002Value + 1);
    module002OnSetTopics(
      module002Draft.topics.map((module002Topic) => ({
        ...module002Topic,
        sources: module002Topic.sources.map((module002Source) =>
          module002Source.id === module002SourceId
            ? {
                ...module002Source,
                fileName: module002File.name,
                fileType: module002FileType,
                status: "parsing",
                error: null,
              }
            : module002Source,
        ),
      })),
    );
    try {
      const module002Result = await module002ParseSourceFile({
        module002File,
        module002Signal: module002Controller.signal,
        module002OnProgress: (module002Progress) =>
          module002SetSourceProgress(module002SourceId, module002Progress),
      });
      if (module002RemovedSourceIds.current.has(module002SourceId)) return;
      module002OnSetTopics(
        module002PatchTopicSource(module002Draft.topics, module002TopicId, module002SourceId, {
          fileName: module002File.name,
          fileType: module002FileType,
          status: module002Result.needsSelection ? "needsSelection" : "ready",
          selectedText: module002Result.selectedText,
          candidates: module002Result.candidates.length
            ? module002Result.candidates
            : module002Result.paragraphs.slice(0, 30),
          error: null,
        }),
      );
    } catch (module002Error) {
      if (module002RemovedSourceIds.current.has(module002SourceId)) return;
      module002OnSetTopics(
        module002PatchTopicSource(module002Draft.topics, module002TopicId, module002SourceId, {
          status: "failed",
          error:
            module002Error.name === "AbortError"
              ? "已取消"
              : module002Error.message,
        }),
      );
    } finally {
      module002AbortControllers.current.delete(module002SourceId);
      module002SetSourceProgress(module002SourceId, null);
      setModule002ParsingCount((module002Value) =>
        Math.max(0, module002Value - 1),
      );
    }
  }

  if (module002Collapsed) {
    return <aside className="module002RightCollapsed"><button aria-label="展开配置区" onClick={module002OnCollapse} type="button"><Settings2 size={18} /></button></aside>;
  }

  return (
    <aside className="module002RightPanel">
      <div className="module002RightTopActions">
        <button onClick={module002OnOpenFormat} type="button"><FileText size={15} />文档格式</button>
        <button onClick={module002OnOpenTemplates} type="button"><Settings2 size={15} />配置党支部模板</button>
        <button onClick={module002OnOpenPeople} type="button"><Users size={15} />人物卡</button>
        <button aria-label="折叠配置区" onClick={module002OnCollapse} type="button"><PanelRightClose size={16} /></button>
      </div>
      <div className="module002RightScroll">
        <Module002Step module002Active={module002ActiveSection === "meetingInfo"} module002Id="meetingInfo" module002OnActivate={() => module002OnFocusSection("meetingInfo")} module002Open={module002OpenSteps.has("meetingInfo")} module002OnToggle={() => module002ToggleStep("meetingInfo")} module002Title="会议信息">
          <div className="module002FormGrid">
            <label className="module002FullField">会议名称<input onChange={(event) => module002OnMeetingInfo({ meetingName: event.target.value })} value={module002Draft.meetingInfo.meetingName} /></label>
            <label>日期<input onChange={(event) => module002OnMeetingInfo({ date: event.target.value })} type="date" value={module002Draft.meetingInfo.date} /></label>
            <label>具体时间<input onChange={(event) => module002OnMeetingInfo({ time: event.target.value })} placeholder="上午9:00" value={module002Draft.meetingInfo.time} /></label>
            <label className="module002FullField">地点<input onChange={(event) => module002OnMeetingInfo({ location: event.target.value })} value={module002Draft.meetingInfo.location} /></label>
          </div>
          <fieldset className="module002CompactFieldset"><legend>参加人员</legend>{module002BranchPeople.length ? module002BranchPeople.map((person) => <label key={person.id}><input checked={module002Draft.meetingInfo.attendeePersonIds.includes(person.id)} onChange={(event) => module002ToggleAttendee(person.id, event.target.checked)} type="checkbox" />{person.name}</label>) : <p>请先在人物卡中添加人员</p>}</fieldset>
          <div className="module002FormGrid">
            <label>主持人<select onChange={(event) => module002OnMeetingInfo({ hostPersonId: event.target.value || null })} value={module002Draft.meetingInfo.hostPersonId ?? ""}><option value="">请选择</option>{module002Draft.meetingInfo.attendeePersonIds.map((id) => module002PersonMap.get(id)).filter(Boolean).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label>记录人<select onChange={(event) => module002OnMeetingInfo({ recorderPersonId: event.target.value || null })} value={module002Draft.meetingInfo.recorderPersonId ?? ""}><option value="">请选择</option>{module002Draft.meetingInfo.attendeePersonIds.map((id) => module002PersonMap.get(id)).filter(Boolean).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="module002FullField">列席人员<input onChange={(event) => module002OnMeetingInfo({ observers: event.target.value })} placeholder="留空显示“无”" value={module002Draft.meetingInfo.observers} /></label>
          </div>
          {module002Draft.templateSnapshot.modules
            .filter((module002Module) => module002Module.type === "customField")
            .map((module002Module) => {
              const Module002CustomInput = module002Module.customField.multiline ? "textarea" : "input";
              return <label key={module002Module.id}>{module002Module.customField.fieldName}{module002Module.customField.required ? " *" : ""}<Module002CustomInput
                onChange={(event) => module002OnUpdateDraft((module002NextDraft) => ({
                  ...module002NextDraft,
                  customValues: { ...module002NextDraft.customValues, [module002Module.id]: event.target.value },
                  editorBlocks: module002NextDraft.editorBlocks.filter((module002Block) => module002Block.moduleId !== module002Module.id),
                }))}
                placeholder={module002Module.customField.placeholder}
                rows={module002Module.customField.multiline ? 3 : undefined}
                value={module002Draft.customValues[module002Module.id] ?? ""}
              /></label>;
            })}
        </Module002Step>

        <Module002Step module002Active={module002ActiveSection === "topics"} module002Badge={module002ParsingCount ? `解析中 ${module002ParsingCount}` : `${module002Draft.topics.length} 项`} module002Id="topics" module002OnActivate={() => module002OnFocusSection("topics")} module002Open={module002OpenSteps.has("topics")} module002OnToggle={() => module002ToggleStep("topics")} module002Title="议题材料">
          <small className="module002FileLimits">请在对应议题内上传材料；最多 20 个文件，单个不超过 20MB，PDF 不超过 50 页。</small>
          {module002Draft.topics.map((topic, topicIndex) => <article className="module002TopicCard" key={topic.id}>
            <div className="module002TopicHeader"><span>{topicIndex + 1}</span><div className="module002TopicTitleField"><input aria-label={`第 ${topicIndex + 1} 个议题标题`} onChange={(event) => module002OnSetTopics(module002Draft.topics.map((item) => item.id === topic.id ? { ...item, title: event.target.value } : item))} value={topic.title} /><label className="module002TopicUploadButton" title="上传本议题材料"><FilePlus2 size={14} />上传材料<input accept=".docx,.pdf,.jpg,.jpeg,.png" aria-label={`第 ${topicIndex + 1} 个议题上传材料`} multiple onChange={(event) => { module002AddFiles(topic.id, event.target.files); event.target.value = ""; }} type="file" /></label></div>{topic.firstTopicLocked ? <small>第一议题锁定</small> : <><button aria-label="上移议题" className="module002IconButton" disabled={topicIndex === 0 || (module002Draft.topics[0]?.firstTopicLocked && topicIndex === 1)} onClick={() => module002OnSetTopics(module002MoveItem(module002Draft.topics, topicIndex, topicIndex - 1).map((item, index) => ({ ...item, order: index })))} type="button"><ArrowUp size={13} /></button><button aria-label="下移议题" className="module002IconButton" disabled={topicIndex === module002Draft.topics.length - 1} onClick={() => module002OnSetTopics(module002MoveItem(module002Draft.topics, topicIndex, topicIndex + 1).map((item, index) => ({ ...item, order: index })))} type="button"><ArrowDown size={13} /></button><button aria-label="删除议题" className="module002IconButton" onClick={() => module002OnSetTopics(module002Draft.topics.filter((item) => item.id !== topic.id).map((item, index) => ({ ...item, order: index })))} type="button"><Trash2 size={14} /></button></>}</div>
            {topic.sources.map((source, sourceIndex) => <div className="module002SourceCard" key={source.id}>
              <div><strong>{source.fileName}</strong><span className={`module002SourceStatus is-${source.status}`}>{source.status === "parsing" ? <LoaderCircle className="module002Spin" size={13} /> : null}{source.status === "ready" ? "已选段" : source.status === "needsSelection" ? "需人工选择" : source.status === "failed" ? source.error : source.status === "parsing" ? module002ParseProgress.get(source.id)?.detail ?? "解析中" : "等待"}</span><button aria-label={`上移 ${source.fileName}`} disabled={sourceIndex === 0} onClick={() => module002OnSetTopics(module002Draft.topics.map((item) => item.id === topic.id ? { ...item, sources: module002MoveItem(item.sources, sourceIndex, sourceIndex - 1) } : item))} type="button"><ArrowUp size={12} /></button><button aria-label={`下移 ${source.fileName}`} disabled={sourceIndex === topic.sources.length - 1} onClick={() => module002OnSetTopics(module002Draft.topics.map((item) => item.id === topic.id ? { ...item, sources: module002MoveItem(item.sources, sourceIndex, sourceIndex + 1) } : item))} type="button"><ArrowDown size={12} /></button><button aria-label={source.status === "parsing" ? `取消并移除 ${source.fileName}` : `移除 ${source.fileName}`} onClick={() => module002RemoveSource(topic.id, source.id)} type="button"><Trash2 size={13} /></button></div>
              {source.status === "parsing" ? <progress aria-label={`${source.fileName}解析进度`} max="1" value={module002ParseProgress.get(source.id)?.ratio ?? 0} /> : null}
              {source.candidates.length ? <select aria-label={`${source.fileName}原文段落`} onChange={(event) => module002OnSetTopics(module002Draft.topics.map((item) => item.id === topic.id ? { ...item, sources: item.sources.map((entry) => entry.id === source.id ? { ...entry, selectedText: event.target.value, status: "ready" } : entry) } : item))} value={source.selectedText}><option value="">人工选择原文</option>{source.candidates.map((candidate, index) => <option key={`${source.id}-${index}`} value={candidate}>候选 {index + 1}：{candidate.slice(0, 28)}</option>)}</select> : null}
              <textarea aria-label={`${source.fileName}选中原文`} onChange={(event) => module002OnSetTopics(module002Draft.topics.map((item) => item.id === topic.id ? { ...item, sources: item.sources.map((entry) => entry.id === source.id ? { ...entry, selectedText: event.target.value, status: event.target.value.trim() ? "ready" : "needsSelection" } : entry) } : item))} placeholder="没有自动候选时，可从本地预览中人工粘贴完整原文段落" rows="3" value={source.selectedText} />
              <label className="module002SourceReparse">重新选择并解析<input accept=".docx,.pdf,.jpg,.jpeg,.png" onChange={(event) => { module002ReparseSource(topic.id, source.id, event.target.files[0]); event.target.value = ""; }} type="file" /></label>
            </div>)}
          </article>)}
          <button className="module002TextButton" onClick={() => module002OnSetTopics([...module002Draft.topics, { id: module002CreateId("topic"), title: "", order: module002Draft.topics.length, firstTopicLocked: false, sources: [] }])} type="button">{module002Draft.topics.length ? "+ 添加后续议题" : "+ 添加第一个议题"}</button>
        </Module002Step>

        <Module002Step module002Active={["speakers", "people"].includes(module002ActiveSection)} module002Badge={`${module002OrderedSpeakers.length} 人`} module002Id="speakers" module002OnActivate={() => module002OnFocusSection("speakers")} module002Open={module002OpenSteps.has("speakers")} module002OnToggle={() => module002ToggleStep("speakers")} module002Title="发言设置">
          <label>模型<select onChange={(event) => module002OnUpdateConfig((config) => ({ ...config, settings: { ...config.settings, preferredModel: event.target.value } }))} value={module002Config.settings.preferredModel}>{module002Models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <fieldset className="module002CompactFieldset"><legend>发言人</legend>{module002Draft.meetingInfo.attendeePersonIds.map((id) => module002PersonMap.get(id)).filter(Boolean).map((person) => { const module002IsHost = person.id === module002Draft.meetingInfo.hostPersonId; return <label key={person.id}><input checked={module002IsHost || module002Draft.speakerPersonIds.includes(person.id)} disabled={module002IsHost} onChange={(event) => module002OnSetSpeakers(event.target.checked ? [...module002Draft.speakerPersonIds, person.id] : module002Draft.speakerPersonIds.filter((item) => item !== person.id))} type="checkbox" />{person.name}{module002IsHost ? "（主持人固定参与普通交流发言）" : ""}</label>; })}</fieldset>
          {module002OrderedSpeakers
            .filter((module002Person) => module002Draft.speeches[module002Person.id]?.trim())
            .map((module002Person) => <button className="module002TextButton" key={`revise-${module002Person.id}`} onClick={() => module002OnRevisePerson(module002Person.id)} type="button">修改 {module002Person.name} 的发言</button>)}
          <label>完整 Prompt<textarea onChange={(event) => module002OnUpdateDraft((draft) => ({ ...draft, prompt: event.target.value }))} rows="8" value={module002Draft.prompt} /></label>
          <div className="module002VariableButtons">{module002RequiredPromptVariables.map((variable) => <button key={variable} onClick={() => module002OnUpdateDraft((draft) => ({ ...draft, prompt: `${draft.prompt}\n${variable}` }))} type="button">{variable}</button>)}</div>
          <button className="module002TextButton" onClick={() => module002OnUpdateDraft((draft) => ({ ...draft, prompt: `【待用户提供真实业务Prompt】\n${module002StandardProtocolText}\n\n正文：\n{{CURRENT_DOCUMENT_BODY}}\n\n人物卡：\n{{PERSON_CARDS}}` }))} type="button">恢复标准 JSON 协议骨架</button>
          <details className="module002RequestPreview"><summary>发送内容预览</summary><p>正文（仅议题材料与会议详细记录）：</p><pre>{module002BuildAiDocumentBody(module002Draft, module002Config)}</pre><p>人物字段：</p><pre>{module002SerializePersonCards(module002OrderedSpeakers, module002Config.personFields, module002PromptIdentityField)}</pre><small>不会发送 API Key、未选人物或原始文件。约 {module002BuildAiDocumentBody(module002Draft, module002Config).length} 字符。</small></details>
        </Module002Step>

        <Module002Step module002Active={module002ActiveSection === "checks"} module002Badge={module002ExportChecks.length ? `${module002ExportChecks.length} 项` : "完成"} module002Id="checks" module002OnActivate={() => module002OnFocusSection("checks")} module002Open={module002OpenSteps.has("checks")} module002OnToggle={() => module002ToggleStep("checks")} module002Title="完成检查">
          <div className="module002Checks">{module002ExportChecks.length ? module002ExportChecks.map((check) => <button key={check.key} onClick={() => { module002OnFocusSection(check.target); if (check.target === "people") module002OnOpenPeople(); }} type="button"><CircleAlert size={14} />{check.label}</button>) : <p><CheckCircle2 size={16} />已满足生成和导出条件</p>}</div>
        </Module002Step>
      </div>
      <div className="module002RightBottomActions">
        <button className="module002GenerateButton" disabled={module002GenerationChecks.length > 0 || module002AiBusy} onClick={module002OnGenerate} title={module002GenerationChecks[0]?.label} type="button">{module002AiBusy ? <LoaderCircle className="module002Spin" size={16} /> : <Sparkles size={16} />}生成全部发言</button>
        <button className="module002ExportButton" disabled={module002ExportChecks.length > 0 || module002ExportBusy} onClick={module002OnExport} title={module002ExportChecks[0]?.label} type="button">{module002ExportBusy ? <LoaderCircle className="module002Spin" size={16} /> : <FileText size={16} />}导出Word</button>
      </div>
    </aside>
  );
}
