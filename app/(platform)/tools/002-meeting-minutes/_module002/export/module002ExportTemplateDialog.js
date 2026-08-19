"use client";

import { FileUp, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import Module002Dialog from "../components/module002Dialog";
import {
  module002CreateBuiltInTemplateMapping,
  module002LoadTemplateFile,
  module002SaveCustomTemplate,
  module002TemplateKinds,
  module002ValidateTemplateUpload,
} from "./module002TemplateAssets";
import { module002ListNoticeTemplateParagraphs } from "./module002TemplateDocx";

const module002NoticeFieldLabels = Object.freeze({
  title: "主标题",
  recipient: "称谓",
  explanation: "通知说明",
  topics: "会议议题",
  attire: "着装提醒",
  signatureDate: "落款日期",
});

/** 将当前配置复制为下一次安全更新所需的导出模板配置。 */
function module002UpdateTemplateConfig(module002Config, module002Kind, module002NextTemplate) {
  return {
    ...module002Config,
    exportTemplates: {
      ...module002Config.exportTemplates,
      [module002Kind]: module002NextTemplate,
    },
  };
}

/** 返回新上传自定义模板必须由用户重新确认的空映射。 */
function module002CreateEmptyCustomMapping(module002Kind) {
  if (module002Kind === module002TemplateKinds.notice) {
    return {
      title: null,
      recipient: null,
      explanation: null,
      topics: null,
      attire: null,
      signatureDate: null,
    };
  }
  return { organization: "", meetingName: "", topics: "" };
}

/** 管理本地工作区内的通知、签到簿模板及用户手动映射规则。 */
export default function Module002ExportTemplateDialog({
  module002Config,
  module002WorkspaceHandle,
  module002OnChange,
  module002OnClose,
  module002Open,
}) {
  const [module002NoticeParagraphs, setModule002NoticeParagraphs] = useState([]);
  const [module002Loading, setModule002Loading] = useState(false);
  const [module002Message, setModule002Message] = useState("");

  useEffect(() => {
    if (!module002Open) return undefined;
    let module002Cancelled = false;
    /** 读取当前通知模板的段落预览，供用户选择六个字段位置。 */
    async function module002LoadNoticePreview() {
      setModule002Loading(true);
      try {
        const module002NoticeFile = await module002LoadTemplateFile(
          module002WorkspaceHandle,
          module002Config.exportTemplates.notice,
          module002TemplateKinds.notice,
        );
        const module002Paragraphs = await module002ListNoticeTemplateParagraphs(
          module002NoticeFile,
        );
        if (!module002Cancelled) setModule002NoticeParagraphs(module002Paragraphs);
      } catch (module002Error) {
        if (!module002Cancelled) setModule002Message(module002Error.message || "通知模板读取失败");
      } finally {
        if (!module002Cancelled) setModule002Loading(false);
      }
    }
    module002LoadNoticePreview();
    return () => { module002Cancelled = true; };
  }, [
    module002Config.exportTemplates.notice,
    module002Open,
    module002WorkspaceHandle,
  ]);

  /** 上传单份模板，写入成功后清空映射，避免把字段写到旧位置。 */
  async function module002HandleUpload(module002Kind, module002File) {
    if (!module002File) return;
    setModule002Message("");
    try {
      module002ValidateTemplateUpload(module002Kind, module002File);
      if (module002Kind === module002TemplateKinds.notice) {
        const module002Paragraphs = await module002ListNoticeTemplateParagraphs(module002File);
        setModule002NoticeParagraphs(module002Paragraphs);
      }
      const module002FileName = await module002SaveCustomTemplate(
        module002WorkspaceHandle,
        module002Kind,
        module002File,
      );
      module002OnChange((module002CurrentConfig) =>
        module002UpdateTemplateConfig(module002CurrentConfig, module002Kind, {
          source: "custom",
          customFileName: module002FileName,
          mapping: module002CreateEmptyCustomMapping(module002Kind),
        }),
      );
      setModule002Message(`${module002Kind === module002TemplateKinds.notice ? "通知" : "签到簿"}模板已保存，请完成映射`);
    } catch (module002Error) {
      setModule002Message(module002Error.message || "模板上传失败");
    }
  }

  /** 恢复系统内置模板和经过核对的默认映射，不删除本地自定义副本。 */
  function module002RestoreBuiltIn(module002Kind) {
    module002OnChange((module002CurrentConfig) =>
      module002UpdateTemplateConfig(module002CurrentConfig, module002Kind, {
        source: "builtIn",
        customFileName: null,
        mapping: module002CreateBuiltInTemplateMapping(module002Kind),
      }),
    );
    setModule002Message(`${module002Kind === module002TemplateKinds.notice ? "通知" : "签到簿"}模板已恢复为系统内置版本`);
  }

  /** 保存用户选定的通知段落位置，配置自动同步至本地工作区。 */
  function module002ChangeNoticeMapping(module002Field, module002Value) {
    module002OnChange((module002CurrentConfig) =>
      module002UpdateTemplateConfig(module002CurrentConfig, module002TemplateKinds.notice, {
        ...module002CurrentConfig.exportTemplates.notice,
        mapping: {
          ...module002CurrentConfig.exportTemplates.notice.mapping,
          [module002Field]: module002Value === "" ? null : Number(module002Value),
        },
      }),
    );
  }

  /** 保存用户填写的签到簿合并单元格范围，导出前会再次验证。 */
  function module002ChangeAttendanceMapping(module002Field, module002Value) {
    module002OnChange((module002CurrentConfig) =>
      module002UpdateTemplateConfig(module002CurrentConfig, module002TemplateKinds.attendance, {
        ...module002CurrentConfig.exportTemplates.attendance,
        mapping: {
          ...module002CurrentConfig.exportTemplates.attendance.mapping,
          [module002Field]: module002Value.toUpperCase().replace(/\s/g, ""),
        },
      }),
    );
  }

  const module002NoticeTemplate = module002Config.exportTemplates.notice;
  const module002AttendanceTemplate = module002Config.exportTemplates.attendance;
  return (
    <Module002Dialog
      module002Description="自定义模板保存在当前模块 002 本地工作区。上传新文件后，请重新完成对应映射。"
      module002Footer={<button className="module002PrimaryButton" onClick={module002OnClose} type="button">完成</button>}
      module002OnClose={module002OnClose}
      module002Open={module002Open}
      module002Title="通知和签到簿模板"
      module002Wide
    >
      <div className="module002ExportTemplateGrid">
        <section className="module002ExportTemplateCard">
          <div className="module002ExportTemplateCardHeader">
            <div><h3>通知模板</h3><small>{module002NoticeTemplate.source === "builtIn" ? "当前：系统内置模板" : "当前：本地自定义模板"}</small></div>
            <div className="module002ExportTemplateCardActions">
              <label className="module002SecondaryButton"><FileUp size={14} />上传替换<input accept=".docx" aria-label="上传通知模板" onChange={(event) => { module002HandleUpload(module002TemplateKinds.notice, event.target.files?.[0]); event.target.value = ""; }} type="file" /></label>
              <button className="module002SecondaryButton" onClick={() => module002RestoreBuiltIn(module002TemplateKinds.notice)} type="button"><RotateCcw size={14} />恢复内置</button>
            </div>
          </div>
          <p>请选择六项内容对应的 Word 段落。格式可以改变，但映射必须准确。</p>
          <div className="module002TemplateMappingList">
            {Object.entries(module002NoticeFieldLabels).map(([module002Field, module002Label]) => <label key={module002Field}>{module002Label}<select disabled={module002Loading || !module002NoticeParagraphs.length} onChange={(event) => module002ChangeNoticeMapping(module002Field, event.target.value)} value={module002NoticeTemplate.mapping[module002Field] ?? ""}><option value="">请选择段落</option>{module002NoticeParagraphs.map((module002Paragraph) => <option key={module002Paragraph.index} value={module002Paragraph.index}>第 {module002Paragraph.index + 1} 段：{module002Paragraph.text || "（空段落）"}</option>)}</select></label>)}
          </div>
        </section>
        <section className="module002ExportTemplateCard">
          <div className="module002ExportTemplateCardHeader">
            <div><h3>签到簿模板</h3><small>{module002AttendanceTemplate.source === "builtIn" ? "当前：系统内置模板" : "当前：本地自定义模板"}</small></div>
            <div className="module002ExportTemplateCardActions">
              <label className="module002SecondaryButton"><FileUp size={14} />上传替换<input accept=".xlsx" aria-label="上传签到簿模板" onChange={(event) => { module002HandleUpload(module002TemplateKinds.attendance, event.target.files?.[0]); event.target.value = ""; }} type="file" /></label>
              <button className="module002SecondaryButton" onClick={() => module002RestoreBuiltIn(module002TemplateKinds.attendance)} type="button"><RotateCcw size={14} />恢复内置</button>
            </div>
          </div>
          <p>填写完整合并单元格范围，例如 C3:F3；导出前会验证范围和合并状态。</p>
          <div className="module002TemplateMappingList">
            <label>参会单位<input onChange={(event) => module002ChangeAttendanceMapping("organization", event.target.value)} placeholder="例如 C2:F2" value={module002AttendanceTemplate.mapping.organization} /></label>
            <label>会议名称<input onChange={(event) => module002ChangeAttendanceMapping("meetingName", event.target.value)} placeholder="例如 C3:F3" value={module002AttendanceTemplate.mapping.meetingName} /></label>
            <label>会议内容<input onChange={(event) => module002ChangeAttendanceMapping("topics", event.target.value)} placeholder="例如 C4:F4" value={module002AttendanceTemplate.mapping.topics} /></label>
          </div>
        </section>
      </div>
      {module002Message ? <p className="module002ExportTemplateMessage" role="status">{module002Message}</p> : null}
    </Module002Dialog>
  );
}
