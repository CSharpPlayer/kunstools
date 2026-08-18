import { describe, expect, it } from "vitest";
import {
  module002CreateDraft,
  module002CreateInitialWorkspace,
} from "../domain/module002Factories";
import {
  module002BuildDocx,
  module002CreateDocxFileName,
} from "./module002Docx";

/** 从内存 DOCX ZIP 中读取单个 OOXML 文件。 */
async function module002ReadDocxXml(module002Blob, module002Path) {
  const {
    BlobReader: Module002BlobReader,
    TextWriter: Module002TextWriter,
    ZipReader: Module002ZipReader,
  } = await import("@zip.js/zip.js");
  const module002Reader = new Module002ZipReader(new Module002BlobReader(module002Blob));
  try {
    const module002Entry = (await module002Reader.getEntries()).find(
      (module002Item) => module002Item.filename === module002Path,
    );
    return module002Entry?.getData(new Module002TextWriter());
  } finally {
    await module002Reader.close();
  }
}

describe("module002 DOCX export", () => {
  it("使用会议名称和中文日期生成默认文件名", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.meetingInfo.date = "2026-08-15";
    expect(module002CreateDocxFileName(module002Draft)).toBe(
      "党员大会_2026年8月15日.docx",
    );
  });

  it("生成包含 OOXML 主文档的 DOCX 包", async () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    const module002Blob = await module002BuildDocx(module002Draft, module002Workspace);
    expect(module002Blob.type).toContain("application/vnd.openxmlformats");
    expect(module002Blob.size).toBeGreaterThan(1000);
  });

  it("默认居中主标题，并将详细记录议题导出为不加粗黑体三号中文二级标题", async () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.topics = [{
      id: "topic-title-test",
      title: "理论学习",
      order: 0,
      firstTopicLocked: false,
      sources: [{ selectedText: "合成材料正文" }],
    }];

    const module002Blob = await module002BuildDocx(module002Draft, module002Workspace);
    const module002Xml = await module002ReadDocxXml(module002Blob, "word/document.xml");
    expect(module002Xml).toContain('<w:jc w:val="center"/>');
    expect(module002Xml).toContain("一、理论学习");
    expect(module002Xml).toMatch(/<w:rFonts[^>]*w:ascii="黑体"[^>]*w:eastAsia="黑体"/);
    expect(module002Xml).toContain('<w:sz w:val="32"/>');
    expect(module002Xml).not.toContain("<w:b/>");
  });

  it("将会议情况说明中的地点以同一行右对齐制表位导出", async () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.meetingInfo.time = "上午 9:00";
    module002Draft.meetingInfo.location = "第一会议室";

    const module002Blob = await module002BuildDocx(module002Draft, module002Workspace);
    const module002Xml = await module002ReadDocxXml(module002Blob, "word/document.xml");
    expect(module002Xml).toMatch(/<w:tab w:val="right" w:pos="9026"\/>/);
    expect(module002Xml).toContain("<w:tab/>");
    expect(module002Xml).toContain("地点：第一会议室");
  });

  it("把 A4、页边距、固定行距、连续空格和编辑器局部格式写入 OOXML", async () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    const module002TitleModule = module002Draft.templateSnapshot.modules.find(
      (module002Module) => module002Module.type === "mainTitle",
    );
    module002Draft.editorBlocks.push({
      id: `block-${module002TitleModule.id}`,
      moduleId: module002TitleModule.id,
      moduleType: "mainTitle",
      referenceId: null,
      content: {
        text: "合成  连续空格",
        json: {
          type: "doc",
          content: [{
            type: "paragraph",
            attrs: { textAlign: "right" },
            content: [{
              type: "text",
              text: "合成  连续空格",
              marks: [
                { type: "bold" },
                {
                  type: "textStyle",
                  attrs: {
                    color: "#123456",
                    fontFamily: "黑体",
                    fontSize: "18pt",
                  },
                },
              ],
            }],
          }],
        },
      },
    });
    const module002Blob = await module002BuildDocx(module002Draft, module002Workspace);
    const module002Xml = await module002ReadDocxXml(module002Blob, "word/document.xml");
    expect(module002Xml).toMatch(/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
    expect(module002Xml).toMatch(/<w:pgMar[^>]*w:top="2098"[^>]*w:right="1474"[^>]*w:bottom="1985"[^>]*w:left="1588"/);
    expect(module002Xml).toContain('<w:spacing w:line="560" w:lineRule="exact"/>');
    expect(module002Xml).toContain('<w:jc w:val="right"/>');
    expect(module002Xml).toMatch(/<w:rFonts[^>]*w:ascii="黑体"[^>]*w:eastAsia="黑体"[^>]*w:hAnsi="黑体"/);
    expect(module002Xml).toContain('<w:b/>');
    expect(module002Xml).toContain('<w:color w:val="123456"/>');
    expect(module002Xml).toContain('<w:sz w:val="36"/>');
    expect(module002Xml).toContain('xml:space="preserve">合成  连续空格</w:t>');
  });
});
