"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";

/** 在段落中保留议题详细记录的二级标题语义，供网页和 Word 同步套用样式。 */
const Module002TopicDetailTitle = Extension.create({
  name: "module002TopicDetailTitle",
  addGlobalAttributes() {
    return [{
      types: ["paragraph"],
      attributes: {
        module002TopicDetailTitle: {
          default: false,
          parseHTML: (module002Element) =>
            module002Element.getAttribute("data-module002-topic-detail-title") === "true",
          renderHTML: (module002Attributes) =>
            module002Attributes.module002TopicDetailTitle
              ? { "data-module002-topic-detail-title": "true" }
              : {},
        },
      },
    }];
  },
});

/** 保留会议情况说明中“时间与地点”同一行两端对齐的段落语义。 */
const Module002MeetingTimeLocation = Extension.create({
  name: "module002MeetingTimeLocation",
  addGlobalAttributes() {
    return [{
      types: ["paragraph"],
      attributes: {
        module002MeetingTimeLocation: {
          default: false,
          parseHTML: (module002Element) =>
            module002Element.getAttribute("data-module002-meeting-time-location") === "true",
          renderHTML: (module002Attributes) =>
            module002Attributes.module002MeetingTimeLocation
              ? { "data-module002-meeting-time-location": "true" }
              : {},
        },
      },
    }];
  },
});

/** 用可伸缩的行内占位分隔时间和地点，避免两端对齐拉开中文字符。 */
const Module002MeetingTimeLocationSpacer = Node.create({
  name: "module002MeetingTimeLocationSpacer",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  parseHTML() {
    return [{ tag: "span[data-module002-meeting-time-location-spacer='true']" }];
  },
  renderHTML() {
    return [
      "span",
      {
        "data-module002-meeting-time-location-spacer": "true",
        contenteditable: "false",
      },
    ];
  },
});

/** 把纯文本转换为不含外部 HTML 的编辑器 JSON。 */
function module002TextToEditorJson(module002Text) {
  return {
    type: "doc",
    content: module002Text.split("\n").map((module002Line) => ({
      type: "paragraph",
      content: module002Line ? [{ type: "text", text: module002Line }] : [],
    })),
  };
}

/** 渲染一个受结构容器保护、内容可编辑的公文模块。 */
export default function Module002RichBlock({
  module002Block,
  module002Style,
  module002Selected,
  module002OnSelect,
  module002OnUpdate,
  module002OnEditorFocus,
}) {
  const module002Editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
      }),
      Underline,
      TextStyleKit.configure({ backgroundColor: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      Module002TopicDetailTitle,
      Module002MeetingTimeLocation,
      Module002MeetingTimeLocationSpacer,
    ],
    content: module002Block.editorJson ?? module002TextToEditorJson(module002Block.text),
    editorProps: {
      transformPastedHTML: (module002Html) => {
        const module002Document = new DOMParser().parseFromString(module002Html, "text/html");
        return module002Document.body.textContent
          ?.split("\n")
          .map((module002Line) => `<p>${module002Line.replace(/[<>&]/g, "")}</p>`)
          .join("") ?? "";
      },
      transformPastedText: (module002Text) => module002Text,
      attributes: {
        class: "module002ProseMirror",
        "aria-label": `${module002Block.label}正文`,
      },
    },
    onFocus: ({ editor: module002FocusedEditor }) => {
      module002OnSelect(module002Block.id);
      module002OnEditorFocus(module002FocusedEditor);
    },
    onUpdate: ({ editor: module002UpdatedEditor }) => {
      module002OnUpdate(module002Block, {
        json: module002UpdatedEditor.getJSON(),
        text: module002UpdatedEditor.getText({ blockSeparator: "\n" }),
      });
    },
  });

  useEffect(() => {
    if (!module002Editor || module002Editor.isFocused) return;
    const module002CurrentText = module002Editor.getText({ blockSeparator: "\n" });
    if (module002CurrentText !== module002Block.text) {
      module002Editor.commands.setContent(
        module002Block.editorJson ?? module002TextToEditorJson(module002Block.text),
        { emitUpdate: false },
      );
    }
  }, [module002Block.editorJson, module002Block.text, module002Editor]);

  return (
    <section
      className={`module002DocumentBlock ${module002Selected ? "module002DocumentBlockSelected" : ""}`}
      data-module-type={module002Block.moduleType}
      onMouseDown={() => module002OnSelect(module002Block.id)}
      style={{
        "--module002BlockColor": module002Style.color,
        "--module002TextColor": module002Style.color,
        "--module002FontFamily": `"${module002Style.fontFamily}"`,
        "--module002FontSize": `${module002Style.fontSizePt}pt`,
        "--module002LineSpacing": `${module002Style.lineSpacingPt}pt`,
        "--module002TextAlign": module002Style.align,
        "--module002FirstIndent": `${module002Style.firstLineIndentChars}em`,
        "--module002LeftIndent": `${module002Style.leftIndentChars}em`,
        "--module002RightIndent": `${module002Style.rightIndentChars}em`,
        "--module002FontWeight": module002Style.bold ? 700 : 400,
        "--module002FontStyle": module002Style.italic ? "italic" : "normal",
        "--module002TextDecoration": module002Style.underline ? "underline" : "none",
      }}
    >
      <span className="module002BlockMarker" title={module002Block.label} />
      <EditorContent editor={module002Editor} />
    </section>
  );
}
