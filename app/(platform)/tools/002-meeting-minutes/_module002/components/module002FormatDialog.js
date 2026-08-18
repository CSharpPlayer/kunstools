"use client";

import { useState } from "react";
import Module002Dialog from "./module002Dialog";

/** 编辑全局公文格式，并由用户明确决定是否应用到当前草稿。 */
export default function Module002FormatDialog({
  module002Open,
  module002OnClose,
  module002Config,
  module002Draft,
  module002OnChangeConfig,
  module002OnApplyToDraft,
}) {
  const [module002DraftFormat, setModule002DraftFormat] = useState(
    structuredClone(module002Config.documentFormat),
  );
  const module002SetNumber = (module002Key, module002Value) =>
    setModule002DraftFormat((module002Format) => ({ ...module002Format, [module002Key]: Number(module002Value) }));
  return (
    <Module002Dialog
      module002Description="修改后成为三个党支部所有未来模板的全局默认格式。"
      module002Footer={<>
        {module002Draft ? <button className="module002SecondaryButton" onClick={() => module002OnApplyToDraft(module002DraftFormat)} type="button">应用到当前草稿</button> : null}
        <button className="module002PrimaryButton" onClick={() => { module002OnChangeConfig((config) => ({ ...config, documentFormat: module002DraftFormat })); module002OnClose(); }} type="button">保存全局格式</button>
      </>}
      module002OnClose={module002OnClose}
      module002Open={module002Open}
      module002Title="文档格式"
    >
      <div className="module002FormatGrid">
        <label>上边距（cm）<input min="1" max="6" step="0.1" onChange={(event) => module002SetNumber("marginTopCm", event.target.value)} type="number" value={module002DraftFormat.marginTopCm} /></label>
        <label>下边距（cm）<input min="1" max="6" step="0.1" onChange={(event) => module002SetNumber("marginBottomCm", event.target.value)} type="number" value={module002DraftFormat.marginBottomCm} /></label>
        <label>左边距（cm）<input min="1" max="6" step="0.1" onChange={(event) => module002SetNumber("marginLeftCm", event.target.value)} type="number" value={module002DraftFormat.marginLeftCm} /></label>
        <label>右边距（cm）<input min="1" max="6" step="0.1" onChange={(event) => module002SetNumber("marginRightCm", event.target.value)} type="number" value={module002DraftFormat.marginRightCm} /></label>
        <label>正文字体<input onChange={(event) => setModule002DraftFormat((format) => ({ ...format, body: { ...format.body, fontFamily: event.target.value } }))} value={module002DraftFormat.body.fontFamily} /></label>
        <label>正文字号（pt）<input min="8" max="72" onChange={(event) => setModule002DraftFormat((format) => ({ ...format, body: { ...format.body, fontSizePt: Number(event.target.value) } }))} type="number" value={module002DraftFormat.body.fontSizePt} /></label>
        <label>固定行距（pt）<input min="12" max="60" onChange={(event) => setModule002DraftFormat((format) => ({ ...format, body: { ...format.body, lineSpacingPt: Number(event.target.value) } }))} type="number" value={module002DraftFormat.body.lineSpacingPt} /></label>
        <label>标题字体<input onChange={(event) => setModule002DraftFormat((format) => ({ ...format, mainTitle: { ...format.mainTitle, fontFamily: event.target.value } }))} value={module002DraftFormat.mainTitle.fontFamily} /></label>
      </div>
      <div className="module002FormatPreview" aria-label="格式预览">
        <strong style={{ fontFamily: module002DraftFormat.mainTitle.fontFamily, fontSize: `${module002DraftFormat.mainTitle.fontSizePt}pt`, lineHeight: `${module002DraftFormat.mainTitle.lineSpacingPt}pt` }}>合成会议记录标题</strong>
        <p style={{ fontFamily: module002DraftFormat.body.fontFamily, fontSize: `${module002DraftFormat.body.fontSizePt}pt`, lineHeight: `${module002DraftFormat.body.lineSpacingPt}pt`, textIndent: `${module002DraftFormat.body.firstLineIndentChars}em` }}>这是格式预览文字，只用于确认字体、字号、缩进和固定行距。</p>
      </div>
      <p className="module002FontNotice">字体只调用本机已安装字体；Word 中仍写入目标字体名。</p>
    </Module002Dialog>
  );
}
