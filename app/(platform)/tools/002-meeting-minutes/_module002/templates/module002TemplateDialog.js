"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import Module002Dialog from "../components/module002Dialog";
import { module002CreateId } from "../domain/module002Factories";
import { module002ValidateTemplateModules } from "../domain/module002TemplateRules";
import { module002PlaceholderPrompt } from "../domain/module002Schemas";
import Module002DataTransferDialog from "../components/module002DataTransferDialog";

const module002ModuleLabels = {
  mainTitle: "主标题",
  meetingSummary: "会议情况说明",
  topicSummary: "议题说明",
  hostOpening: "主持人开头发言",
  topicDetails: "会议详细记录",
  groupSpeeches: "全体交流发言",
  hostClosing: "主持人总结发言",
  staticText: "静态文字",
  customField: "自定义填写字段",
};

/** 单个支持指针和键盘拖动的模板模块。 */
function Module002SortableModule({
  module002Module,
  module002OnDelete,
  module002OnChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module002Module.id });
  return (
    <li className="module002TemplateModuleRow" ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="module002TemplateModuleMain">
        <button aria-label={`拖动 ${module002Module.label}`} className="module002DragHandle" type="button" {...attributes} {...listeners}><GripVertical size={16} /></button>
        <span>{module002Module.label}</span>
        <small>{module002Module.type}</small>
        <button aria-label={`删除 ${module002Module.label}`} className="module002IconButton" onClick={module002OnDelete} type="button"><Trash2 size={15} /></button>
      </div>
      <details className="module002ModuleSettings">
        <summary>模块设置</summary>
        <div className="module002ModuleSettingsGrid">
          <label>显示名称<input onChange={(event) => module002OnChange({ ...module002Module, label: event.target.value })} value={module002Module.label} /></label>
          <label>字体<input onChange={(event) => module002OnChange({ ...module002Module, styleOverride: { ...module002Module.styleOverride, fontFamily: event.target.value } })} placeholder="继承全局" value={module002Module.styleOverride.fontFamily ?? ""} /></label>
          <label>字号（pt）<input min="8" max="72" onChange={(event) => module002OnChange({ ...module002Module, styleOverride: { ...module002Module.styleOverride, fontSizePt: event.target.value ? Number(event.target.value) : undefined } })} placeholder="继承" type="number" value={module002Module.styleOverride.fontSizePt ?? ""} /></label>
          <label>对齐<select onChange={(event) => module002OnChange({ ...module002Module, styleOverride: { ...module002Module.styleOverride, align: event.target.value || undefined } })} value={module002Module.styleOverride.align ?? ""}><option value="">继承全局</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option><option value="justify">两端对齐</option></select></label>
          <label>首行缩进（字符）<input min="0" max="10" onChange={(event) => module002OnChange({ ...module002Module, styleOverride: { ...module002Module.styleOverride, firstLineIndentChars: event.target.value === "" ? undefined : Number(event.target.value) } })} placeholder="继承" type="number" value={module002Module.styleOverride.firstLineIndentChars ?? ""} /></label>
        </div>
        {module002Module.type === "staticText" ? <label className="module002ModuleFullSetting">默认静态文字<textarea onChange={(event) => module002OnChange({ ...module002Module, staticText: event.target.value })} rows="3" value={module002Module.staticText} /></label> : null}
        {module002Module.type === "customField" ? <div className="module002ModuleSettingsGrid">
          <label>字段名<input onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, fieldName: event.target.value } })} value={module002Module.customField.fieldName} /></label>
          <label>正文显示标签<input onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, displayLabel: event.target.value } })} value={module002Module.customField.displayLabel} /></label>
          <label>默认值<input onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, defaultValue: event.target.value } })} value={module002Module.customField.defaultValue} /></label>
          <label>占位提示<input onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, placeholder: event.target.value } })} value={module002Module.customField.placeholder} /></label>
          <label className="module002InlineCheck"><input checked={module002Module.customField.required} onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, required: event.target.checked } })} type="checkbox" />必填</label>
          <label className="module002InlineCheck"><input checked={module002Module.customField.multiline} onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, multiline: event.target.checked } })} type="checkbox" />多行</label>
          <label className="module002InlineCheck"><input checked={module002Module.customField.sendToAi} onChange={(event) => module002OnChange({ ...module002Module, customField: { ...module002Module.customField, sendToAi: event.target.checked } })} type="checkbox" />发送给 AI</label>
        </div> : null}
      </details>
    </li>
  );
}

/** 管理支部模板、结构模块、复制和依赖约束。 */
export default function Module002TemplateDialog({
  module002Open,
  module002OnClose,
  module002Config,
  module002OnChange,
}) {
  const [module002BranchId, setModule002BranchId] = useState(module002Config.branches[0]?.id);
  const module002Templates = useMemo(() => module002Config.templates.filter((item) => item.branchId === module002BranchId), [module002BranchId, module002Config.templates]);
  const [module002TemplateId, setModule002TemplateId] = useState(module002Templates[0]?.id ?? null);
  const [module002TransferOpen, setModule002TransferOpen] = useState(false);
  const module002Template = module002Config.templates.find((item) => item.id === module002TemplateId) ?? module002Templates[0] ?? null;
  const module002Errors = module002Template ? module002ValidateTemplateModules(module002Template.modules) : [];
  const module002Sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** 更新当前模板，但不触碰已有草稿快照。 */
  function module002UpdateTemplate(module002Updater) {
    if (!module002Template) return;
    module002OnChange((module002NextConfig) => ({
      ...module002NextConfig,
      templates: module002NextConfig.templates.map((module002Item) =>
        module002Item.id === module002Template.id
          ? { ...module002Updater(module002Item), revision: module002Item.revision + 1, updatedAt: new Date().toISOString() }
          : module002Item,
      ),
    }));
  }

  /** 新建只含主标题的最小空白模板。 */
  function module002CreateTemplate() {
    const module002Now = new Date().toISOString();
    const module002NewTemplate = {
      id: module002CreateId("template"), branchId: module002BranchId, name: "新建模板", revision: 0,
      createdAt: module002Now, updatedAt: module002Now, defaultPrompt: module002PlaceholderPrompt,
      defaults: { location: "", hostPersonId: null, recorderPersonId: null },
      modules: [{ id: module002CreateId("module"), type: "mainTitle", label: "主标题", staticText: "", customField: null, styleOverride: {} }],
    };
    module002OnChange((module002NextConfig) => ({ ...module002NextConfig, templates: [...module002NextConfig.templates, module002NewTemplate] }));
    setModule002TemplateId(module002NewTemplate.id);
  }

  /** 添加系统模块、静态文字或自定义字段。 */
  function module002AddModule(module002Type) {
    const module002CustomField = module002Type === "customField" ? {
      fieldName: "自定义字段", displayLabel: "自定义字段：", defaultValue: "", placeholder: "请输入", required: false, multiline: false, sendToAi: false,
    } : null;
    const module002NewModule = { id: module002CreateId("module"), type: module002Type, label: module002ModuleLabels[module002Type], staticText: module002Type === "staticText" ? "静态文字" : "", customField: module002CustomField, styleOverride: {} };
    const module002NextModules = [...module002Template.modules, module002NewModule];
    const module002NextErrors = module002ValidateTemplateModules(module002NextModules);
    if (module002NextErrors.length) {
      window.alert(module002NextErrors.join("\n"));
      return;
    }
    module002UpdateTemplate((module002Item) => ({
      ...module002Item,
      modules: module002NextModules,
    }));
  }

  return (
    <Module002Dialog module002Description="模板修改只影响以后新建的会议，当前草稿继续使用快照。" module002OnClose={module002OnClose} module002Open={module002Open} module002Title="配置党支部模板" module002Wide>
      <div className="module002TemplateLayout">
        <aside className="module002TemplateSidebar">
          <select aria-label="党支部" onChange={(event) => { setModule002BranchId(event.target.value); setModule002TemplateId(null); }} value={module002BranchId}>
            {module002Config.branches.map((module002Branch) => <option key={module002Branch.id} value={module002Branch.id}>{module002Branch.name}</option>)}
          </select>
          <button className="module002SecondaryButton" onClick={module002CreateTemplate} type="button"><Plus size={15} />新建空白模板</button>
          <button className="module002SecondaryButton" onClick={() => setModule002TransferOpen(true)} type="button"><Archive size={15} />配置导入导出</button>
          <div className="module002TemplateList">
            {module002Templates.map((module002Item) => <button className={module002Item.id === module002Template?.id ? "isActive" : ""} key={module002Item.id} onClick={() => setModule002TemplateId(module002Item.id)} type="button">{module002Item.name}</button>)}
          </div>
        </aside>
        <div className="module002TemplateEditor">
          {module002Template ? <>
            <div className="module002TemplateHeaderFields">
              <label>模板名称<input onChange={(event) => module002UpdateTemplate((item) => ({ ...item, name: event.target.value }))} value={module002Template.name} /></label>
              <button className="module002SecondaryButton" onClick={() => {
                const module002CopyTemplate = { ...structuredClone(module002Template), id: module002CreateId("template"), name: `${module002Template.name} - 副本`, revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), modules: module002Template.modules.map((item) => ({ ...item, id: module002CreateId("module") })) };
                module002OnChange((config) => ({ ...config, templates: [...config.templates, module002CopyTemplate] }));
                setModule002TemplateId(module002CopyTemplate.id);
              }} type="button"><Copy size={15} />复制</button>
              <select aria-label="复制到其他支部" defaultValue="" onChange={(event) => {
                if (!event.target.value) return;
                const module002CopyTemplate = { ...structuredClone(module002Template), id: module002CreateId("template"), branchId: event.target.value, name: `${module002Template.name} - 副本`, revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), modules: module002Template.modules.map((item) => ({ ...item, id: module002CreateId("module") })) };
                module002OnChange((config) => ({ ...config, templates: [...config.templates, module002CopyTemplate] }));
                event.target.value = "";
              }}><option value="">复制到其他支部</option>{module002Config.branches.filter((item) => item.id !== module002Template.branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <button className="module002DangerButton" onClick={() => {
                if (!window.confirm(`确定删除模板“${module002Template.name}”吗？已有草稿快照不会改变。`)) return;
                module002OnChange((config) => ({ ...config, templates: config.templates.filter((item) => item.id !== module002Template.id) }));
                setModule002TemplateId(null);
              }} type="button"><Trash2 size={15} />删除</button>
            </div>
            {module002Errors.length ? <div className="module002InlineError" role="alert">{module002Errors.map((item) => <p key={item}>{item}</p>)}</div> : null}
            <div className="module002AddModuleRow"><span>添加模块</span>{Object.entries(module002ModuleLabels).map(([module002Type, module002Label]) => <button key={module002Type} onClick={() => module002AddModule(module002Type)} type="button">{module002Label}</button>)}</div>
            <DndContext collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              module002UpdateTemplate((item) => {
                const module002OldIndex = item.modules.findIndex((module) => module.id === active.id);
                const module002NewIndex = item.modules.findIndex((module) => module.id === over.id);
                return { ...item, modules: arrayMove(item.modules, module002OldIndex, module002NewIndex) };
              });
            }} sensors={module002Sensors}>
              <SortableContext items={module002Template.modules.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <ul className="module002TemplateModules">{module002Template.modules.map((module002Module) => <Module002SortableModule key={module002Module.id} module002Module={module002Module} module002OnChange={(module002NextModule) => module002UpdateTemplate((item) => ({ ...item, modules: item.modules.map((module002Item) => module002Item.id === module002Module.id ? module002NextModule : module002Item) }))} module002OnDelete={() => {
                  const module002Next = module002Template.modules.filter((item) => item.id !== module002Module.id);
                  const module002NextErrors = module002ValidateTemplateModules(module002Next);
                  if (module002NextErrors.length) { window.alert(module002NextErrors.join("\n")); return; }
                  module002UpdateTemplate((item) => ({ ...item, modules: module002Next }));
                }} />)}</ul>
              </SortableContext>
            </DndContext>
          </> : <div className="module002EmptyState">当前支部暂无模板</div>}
        </div>
      </div>
      <Module002DataTransferDialog
        module002Config={module002Config}
        module002OnClose={() => setModule002TransferOpen(false)}
        module002OnImport={(module002Merged) =>
          module002OnChange(() => module002Merged)
        }
        module002Open={module002TransferOpen}
      />
    </Module002Dialog>
  );
}
