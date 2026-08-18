"use client";

import { Download, FileArchive, Upload } from "lucide-react";
import { useState } from "react";
import {
  module002BuildConfigConflicts,
  module002CreateConfigZip,
  module002InspectConfigZip,
  module002MergeImportedConfig,
} from "../workspace/module002ConfigZip";
import Module002Dialog from "./module002Dialog";

const module002DefaultSelection = {
  templates: true,
  people: true,
  personFields: true,
  documentFormat: true,
  prompts: true,
  settings: true,
};

/** 提供配置 ZIP 导出、预览、逐项冲突处理和确认合并。 */
export default function Module002DataTransferDialog({
  module002Open,
  module002OnClose,
  module002Config,
  module002OnImport,
}) {
  const [module002Inspection, setModule002Inspection] = useState(null);
  const [module002Selection, setModule002Selection] = useState(module002DefaultSelection);
  const [module002Conflicts, setModule002Conflicts] = useState([]);
  const [module002Error, setModule002Error] = useState("");
  const [module002Busy, setModule002Busy] = useState(false);

  /** 生成 ZIP 后由用户明确选择保存位置。 */
  async function module002ExportConfig() {
    setModule002Busy(true);
    setModule002Error("");
    try {
      if (typeof window.showSaveFilePicker !== "function") {
        throw new Error("当前浏览器不支持配置另存为");
      }
      const module002Handle = await window.showSaveFilePicker({
        id: "kunstools-module002-config",
        suggestedName: `module002-config-${new Date().toISOString().slice(0, 10)}.zip`,
        types: [{ description: "模块 002 配置 ZIP", accept: { "application/zip": [".zip"] } }],
      });
      const module002Blob = await module002CreateConfigZip(module002Config);
      const module002Writable = await module002Handle.createWritable();
      await module002Writable.write(module002Blob);
      await module002Writable.close();
    } catch (module002Failure) {
      if (module002Failure?.name !== "AbortError") setModule002Error(module002Failure.message);
    } finally {
      setModule002Busy(false);
    }
  }

  /** 只读检查用户选择的 ZIP，尚不修改本机配置。 */
  async function module002InspectFile(module002File) {
    setModule002Busy(true);
    setModule002Error("");
    try {
      const module002NextInspection = await module002InspectConfigZip(module002File);
      setModule002Inspection(module002NextInspection);
      setModule002Conflicts(
        module002BuildConfigConflicts(module002Config, module002NextInspection.config),
      );
    } catch (module002Failure) {
      setModule002Inspection(null);
      setModule002Error(module002Failure.message);
    } finally {
      setModule002Busy(false);
    }
  }

  /** 完整构建并校验合并结果后才一次性替换本机配置状态。 */
  function module002ConfirmImport() {
    const module002Decisions = Object.fromEntries(
      module002Conflicts.map((module002Conflict) => [
        module002Conflict.key,
        module002Conflict.decision,
      ]),
    );
    try {
      const module002Merged = module002MergeImportedConfig({
        module002Local: module002Config,
        module002Imported: module002Inspection.config,
        module002Selection,
        module002Decisions,
      });
      module002OnImport(module002Merged);
      module002OnClose();
    } catch (module002Failure) {
      setModule002Error(`导入已回滚：${module002Failure.message}`);
    }
  }

  return (
    <Module002Dialog
      module002Description="迁移包不包含 API Key、当前草稿、议题原文件或导出结果。"
      module002OnClose={module002OnClose}
      module002Open={module002Open}
      module002Title="配置导入与导出"
      module002Wide
    >
      <div className="module002TransferActions">
        <button className="module002SecondaryButton" disabled={module002Busy} onClick={module002ExportConfig} type="button"><Download size={15} />导出配置 ZIP</button>
        <label className="module002SecondaryButton"><Upload size={15} />选择配置 ZIP<input accept=".zip" onChange={(event) => { if (event.target.files[0]) module002InspectFile(event.target.files[0]); event.target.value = ""; }} type="file" /></label>
      </div>
      {module002Error ? <div className="module002InlineError" role="alert">{module002Error}</div> : null}
      {module002Inspection ? <div className="module002TransferPreview">
        <h3><FileArchive size={16} />可导入内容</h3>
        <div className="module002TransferChecks">
          {[
            ["templates", `模板（${module002Inspection.config.templates.length}）`],
            ["people", `人物卡（${module002Inspection.config.people.length}）`],
            ["personFields", "人物字段结构"],
            ["documentFormat", "全局文档格式"],
            ["prompts", "模板 Prompt"],
            ["settings", "首选模型"],
          ].map(([module002Key, module002Label]) => <label key={module002Key}><input checked={module002Selection[module002Key]} onChange={(event) => setModule002Selection((value) => ({ ...value, [module002Key]: event.target.checked }))} type="checkbox" />{module002Label}</label>)}
        </div>
        {module002Conflicts.length ? <div className="module002ConflictList"><h4>冲突处理</h4>{module002Conflicts.map((module002Conflict, module002Index) => <label key={module002Conflict.key}><span>{module002Conflict.imported.name}</span><select onChange={(event) => setModule002Conflicts((items) => items.map((item, index) => index === module002Index ? { ...item, decision: event.target.value } : item))} value={module002Conflict.decision}><option value="keepLocal">保留本机</option><option value="useImported">使用导入版</option><option value="copy">另存副本</option></select></label>)}</div> : null}
        <button className="module002PrimaryButton" onClick={module002ConfirmImport} type="button">确认合并</button>
      </div> : null}
    </Module002Dialog>
  );
}
