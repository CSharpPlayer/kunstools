"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { module002BuildDocumentBlocks } from "../domain/module002Document";
import Module002RichBlock from "./module002RichBlock";

const module002FontOptions = [
  "仿宋_GB2312",
  "方正小标宋简体",
  "黑体",
  "楷体_GB2312",
  "宋体",
  "Microsoft YaHei",
];

/** 提供紧凑公文工具栏并把命令发送到当前正文模块。 */
function Module002EditorToolbar({ module002Editor }) {
  const module002Command = (module002Callback) => {
    if (module002Editor) module002Callback(module002Editor.chain().focus()).run();
  };
  return (
    <div className="module002EditorToolbar" role="toolbar" aria-label="文档格式工具栏">
      <button aria-label="撤销" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.undo())} type="button"><Undo2 size={16} /></button>
      <button aria-label="重做" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.redo())} type="button"><Redo2 size={16} /></button>
      <span className="module002ToolbarDivider" />
      <select aria-label="字体" defaultValue="仿宋_GB2312" disabled={!module002Editor} onChange={(event) => module002Command((chain) => chain.setFontFamily(event.target.value))}>
        {module002FontOptions.map((module002Font) => <option key={module002Font}>{module002Font}</option>)}
      </select>
      <select aria-label="字号" defaultValue="16pt" disabled={!module002Editor} onChange={(event) => module002Command((chain) => chain.setFontSize(event.target.value))}>
        {[12, 14, 16, 18, 22].map((module002Size) => <option key={module002Size} value={`${module002Size}pt`}>{module002Size}pt</option>)}
      </select>
      <button aria-label="加粗" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.toggleBold())} type="button"><Bold size={16} /></button>
      <button aria-label="斜体" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.toggleItalic())} type="button"><Italic size={16} /></button>
      <button aria-label="下划线" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.toggleUnderline())} type="button"><UnderlineIcon size={16} /></button>
      <input aria-label="文字颜色" disabled={!module002Editor} onChange={(event) => module002Command((chain) => chain.setColor(event.target.value))} type="color" defaultValue="#000000" />
      <span className="module002ToolbarDivider" />
      <button aria-label="左对齐" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.setTextAlign("left"))} type="button"><AlignLeft size={16} /></button>
      <button aria-label="居中" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.setTextAlign("center"))} type="button"><AlignCenter size={16} /></button>
      <button aria-label="右对齐" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.setTextAlign("right"))} type="button"><AlignRight size={16} /></button>
      <button aria-label="两端对齐" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.setTextAlign("justify"))} type="button"><AlignJustify size={16} /></button>
      <button aria-label="清除格式" disabled={!module002Editor} onClick={() => module002Command((chain) => chain.unsetAllMarks().clearNodes())} type="button"><RemoveFormatting size={16} /></button>
    </div>
  );
}

/** 渲染 A4 公文编辑区域，模块边界只能在模板构建器中改变。 */
export default function Module002Editor({
  module002Draft,
  module002Config,
  module002OnUpdateBlock,
  module002ActiveSection,
  module002OnFocusSection,
}) {
  const [module002ActiveEditor, setModule002ActiveEditor] = useState(null);
  const [module002SelectedBlockId, setModule002SelectedBlockId] = useState(null);
  const [module002PageCount, setModule002PageCount] = useState(1);
  const module002PaperRef = useRef(null);
  const module002Blocks = useMemo(
    () => module002BuildDocumentBlocks(module002Draft, module002Config),
    [module002Config, module002Draft],
  );
  const module002SectionForType = (module002Type) => {
    if (["mainTitle", "meetingSummary", "customField"].includes(module002Type)) {
      return "meetingInfo";
    }
    if (["topicSummary", "topicDetails"].includes(module002Type)) return "topics";
    return "speakers";
  };
  const module002NormalizedActiveSection = module002ActiveSection === "people"
    ? "speakers"
    : module002ActiveSection;
  const module002InternalBlock = module002Blocks.find(
    (module002Block) => module002Block.id === module002SelectedBlockId,
  );
  const module002ActiveBlockId =
    module002InternalBlock &&
    module002SectionForType(module002InternalBlock.moduleType) === module002NormalizedActiveSection
      ? module002InternalBlock.id
      : module002Blocks.find(
          (module002Block) =>
            module002SectionForType(module002Block.moduleType) === module002NormalizedActiveSection,
        )?.id;

  /** 选择正文块时同步打开并标记右侧对应业务步骤。 */
  function module002SelectBlock(module002Block) {
    setModule002SelectedBlockId(module002Block.id);
    module002OnFocusSection?.(module002SectionForType(module002Block.moduleType));
  }

  useEffect(() => {
    const module002Paper = module002PaperRef.current;
    if (!module002Paper || typeof ResizeObserver === "undefined") return undefined;
    const module002Observer = new ResizeObserver(() => {
      setModule002PageCount(Math.max(1, Math.ceil(module002Paper.scrollHeight / 1123)));
    });
    module002Observer.observe(module002Paper);
    return () => module002Observer.disconnect();
  }, []);

  return (
    <div className="module002EditorArea">
      <div className="module002EditorToolbarRow"><Module002EditorToolbar module002Editor={module002ActiveEditor} /><span>A4 · {module002PageCount} 页</span></div>
      <div className="module002PaperScroller">
        <article className="module002Paper" aria-label="A4 会议记录编辑区" ref={module002PaperRef}>
          {module002Blocks.map((module002Block) => {
            const module002BaseStyle =
              module002Block.moduleType === "mainTitle"
                ? module002Draft.documentFormatSnapshot.mainTitle
                : module002Draft.documentFormatSnapshot.body;
            const module002Style = { ...module002BaseStyle, ...module002Block.styleOverride };
            return (
              <Module002RichBlock
                key={module002Block.id}
                module002Block={module002Block}
                module002OnEditorFocus={setModule002ActiveEditor}
                module002OnSelect={() => module002SelectBlock(module002Block)}
                module002OnUpdate={module002OnUpdateBlock}
                module002Selected={module002ActiveBlockId === module002Block.id}
                module002Style={module002Style}
              />
            );
          })}
        </article>
      </div>
    </div>
  );
}
