import { module002BuildDocumentBlocks } from "../domain/module002Document";

const module002TwipsPerCm = 567;

/** 把编辑器字号字符串统一转换为 Word 使用的磅值。 */
function module002ParseFontSizePt(module002Value, module002Fallback) {
  if (typeof module002Value === "number") return module002Value;
  if (typeof module002Value !== "string") return module002Fallback;
  const module002Number = Number.parseFloat(module002Value);
  if (!Number.isFinite(module002Number)) return module002Fallback;
  return module002Value.endsWith("px") ? module002Number * 0.75 : module002Number;
}

/** 将 Tiptap 段落和文本标记转换为可确定性导出的中间结构。 */
function module002BuildRichParagraphs(
  module002Block,
  module002Style,
  module002SecondTitleStyle,
) {
  if (module002Block.editorJson?.type !== "doc") {
    return module002Block.text.split("\n").map((module002Text) => ({
      align: module002Style.align,
      style: module002Style,
      runs: [{ text: module002Text, style: module002Style }],
    }));
  }
  return (module002Block.editorJson.content ?? []).map((module002ParagraphNode) => {
    const module002IsTopicDetailTitle =
      module002Block.moduleType === "topicDetails" &&
      module002ParagraphNode.attrs?.module002TopicDetailTitle === true;
    const module002IsMeetingTimeLocation =
      module002Block.moduleType === "meetingSummary" &&
      module002ParagraphNode.attrs?.module002MeetingTimeLocation === true;
    const module002ParagraphStyle = module002IsTopicDetailTitle
      ? module002SecondTitleStyle
      : module002Style;
    return {
    align: module002ParagraphNode.attrs?.textAlign ?? module002ParagraphStyle.align,
    rightTab: module002IsMeetingTimeLocation,
    style: module002ParagraphStyle,
    runs: (module002ParagraphNode.content ?? []).map((module002TextNode) => {
      if (module002TextNode.type === "hardBreak") {
        return { text: "", break: 1, style: module002ParagraphStyle };
      }
      if (module002TextNode.type === "module002MeetingTimeLocationSpacer") {
        return { text: "\t", style: module002ParagraphStyle };
      }
      const module002RunStyle = { ...module002ParagraphStyle };
      (module002TextNode.marks ?? []).forEach((module002Mark) => {
        if (module002Mark.type === "bold") module002RunStyle.bold = true;
        if (module002Mark.type === "italic") module002RunStyle.italic = true;
        if (module002Mark.type === "underline") module002RunStyle.underline = true;
        if (module002Mark.type === "textStyle") {
          if (module002Mark.attrs?.color) module002RunStyle.color = module002Mark.attrs.color;
          if (module002Mark.attrs?.fontFamily) {
            module002RunStyle.fontFamily = module002Mark.attrs.fontFamily;
          }
          module002RunStyle.fontSizePt = module002ParseFontSizePt(
            module002Mark.attrs?.fontSize,
            module002RunStyle.fontSizePt,
          );
        }
      });
      return {
        text: module002TextNode.text ?? "",
        style: module002RunStyle,
      };
    }),
  };
  });
}

/** 生成安全的默认 Word 文件名。 */
export function module002CreateDocxFileName(module002Draft) {
  const module002Name = (module002Draft.meetingInfo.meetingName || "会议记录")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  const [module002Year, module002Month, module002Day] = module002Draft.meetingInfo.date
    .split("-")
    .map(Number);
  return `${module002Name}_${module002Year}年${module002Month}月${module002Day}日.docx`;
}

/** 对草稿关键内容计算导出指纹。 */
export async function module002CreateDraftFingerprint(module002Draft) {
  const module002Clone = structuredClone(module002Draft);
  module002Clone.exportedFingerprint = null;
  module002Clone.updatedAt = "";
  module002Clone.revision = 0;
  const module002Bytes = new TextEncoder().encode(JSON.stringify(module002Clone));
  const module002Hash = await crypto.subtle.digest("SHA-256", module002Bytes);
  return Array.from(new Uint8Array(module002Hash), (module002Byte) =>
    module002Byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** 将结构化文档块确定性映射为 A4 DOCX。 */
export async function module002BuildDocx(module002Draft, module002Config) {
  const {
    AlignmentType: Module002AlignmentType,
    Document: Module002Document,
    LineRuleType: Module002LineRuleType,
    Packer: Module002Packer,
    Paragraph: Module002Paragraph,
    Tab: Module002Tab,
    TabStopPosition: Module002TabStopPosition,
    TabStopType: Module002TabStopType,
    TextRun: Module002TextRun,
  } = await import("docx");
  const module002Format = module002Draft.documentFormatSnapshot;
  const module002SecondTitleStyle = module002Format.secondTitle;
  const module002AlignmentMap = {
    left: Module002AlignmentType.LEFT,
    center: Module002AlignmentType.CENTER,
    right: Module002AlignmentType.RIGHT,
    justify: Module002AlignmentType.JUSTIFIED,
  };
  const module002Paragraphs = [];
  module002BuildDocumentBlocks(module002Draft, module002Config).forEach(
    (module002Block) => {
      const module002StyleBase =
        module002Block.moduleType === "mainTitle"
          ? module002Format.mainTitle
          : module002Format.body;
      const module002Style = { ...module002StyleBase, ...module002Block.styleOverride };
      module002BuildRichParagraphs(
        module002Block,
        module002Style,
        module002SecondTitleStyle,
      ).forEach(
        (module002RichParagraph) => {
        module002Paragraphs.push(
          new Module002Paragraph({
            alignment: module002AlignmentMap[module002RichParagraph.align],
            spacing: {
              line: Math.round(module002RichParagraph.style.lineSpacingPt * 20),
              lineRule: Module002LineRuleType.EXACT,
            },
            indent: {
              firstLine: Math.round(
                module002RichParagraph.style.firstLineIndentChars * module002RichParagraph.style.fontSizePt * 20,
              ),
              left: Math.round(module002RichParagraph.style.leftIndentChars * module002RichParagraph.style.fontSizePt * 20),
              right: Math.round(module002RichParagraph.style.rightIndentChars * module002RichParagraph.style.fontSizePt * 20),
            },
            tabStops: module002RichParagraph.rightTab
              ? [{ type: Module002TabStopType.RIGHT, position: Module002TabStopPosition.MAX }]
              : undefined,
            children: (module002RichParagraph.runs.length
              ? module002RichParagraph.runs
              : [{ text: "", style: module002Style }]
            ).flatMap((module002Run) => {
              const module002RunSegments = module002Run.text.split("\t");

              return module002RunSegments.flatMap((module002RunText, module002RunIndex) => [
                new Module002TextRun({
                  text: module002RunText,
                  break: module002RunIndex === 0 ? module002Run.break : undefined,
                  bold: module002Run.style.bold,
                  italics: module002Run.style.italic,
                  underline: module002Run.style.underline ? {} : undefined,
                  color: module002Run.style.color.replace("#", ""),
                  size: Math.round(module002Run.style.fontSizePt * 2),
                  font: {
                    name: module002Run.style.fontFamily,
                    eastAsia: module002Run.style.fontFamily,
                  },
                }),
                ...(module002RunIndex < module002RunSegments.length - 1
                  ? [new Module002Tab()]
                  : []),
              ]);
            }),
          }),
        );
      });
    },
  );
  const module002Document = new Module002Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: Math.round(module002Format.marginTopCm * module002TwipsPerCm),
              bottom: Math.round(module002Format.marginBottomCm * module002TwipsPerCm),
              left: Math.round(module002Format.marginLeftCm * module002TwipsPerCm),
              right: Math.round(module002Format.marginRightCm * module002TwipsPerCm),
            },
          },
        },
        children: module002Paragraphs,
      },
    ],
  });
  return Module002Packer.toBlob(module002Document);
}

/** 由用户点击触发 Windows/Chromium 另存为流程。 */
export async function module002SaveDocx(module002Draft, module002Config) {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error("当前浏览器不支持 Word 另存为，请使用桌面版 Chrome 或 Edge");
  }
  const module002Handle = await window.showSaveFilePicker({
    id: "kunstools-module002-docx",
    suggestedName: module002CreateDocxFileName(module002Draft),
    types: [
      {
        description: "Word 文档",
        accept: {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        },
      },
    ],
  });
  const module002Blob = await module002BuildDocx(module002Draft, module002Config);
  const module002Writable = await module002Handle.createWritable();
  try {
    await module002Writable.write(module002Blob);
    await module002Writable.close();
  } catch (module002Error) {
    await module002Writable.abort?.(module002Error).catch(() => {});
    throw module002Error;
  }
  return module002CreateDraftFingerprint(module002Draft);
}
