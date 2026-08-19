import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  module002BuildNoticeDocx,
  module002ListNoticeTemplateParagraphs,
} from "./module002TemplateDocx";

/** 从生成后的 DOCX ZIP 中读取正文 XML，验证模板图形和文字均被保留。 */
async function module002ReadDocxXml(module002Blob) {
  const {
    BlobReader: Module002BlobReader,
    TextWriter: Module002TextWriter,
    ZipReader: Module002ZipReader,
  } = await import("@zip.js/zip.js");
  const module002Reader = new Module002ZipReader(new Module002BlobReader(module002Blob));
  try {
    const module002Entry = (await module002Reader.getEntries()).find(
      (module002Item) => module002Item.filename === "word/document.xml",
    );
    return module002Entry.getData(new Module002TextWriter());
  } finally {
    await module002Reader.close();
  }
}

/** 读取项目内置通知模板，避免测试依赖用户电脑上的临时目录。 */
async function module002ReadBuiltInNoticeTemplate() {
  const module002Bytes = await readFile(
    path.join(process.cwd(), "public", "module002-templates", "module002-notice-template.docx"),
  );
  return new File([module002Bytes], "module002-notice-template.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

describe("module002 notice template export", () => {
  it("读取内置模板段落并替换六项内容，同时保留底部红线图形", async () => {
    const module002TemplateFile = await module002ReadBuiltInNoticeTemplate();
    const module002Paragraphs = await module002ListNoticeTemplateParagraphs(module002TemplateFile);
    expect(module002Paragraphs[7].text).toContain("关于召开第X党支部");
    const module002Blob = await module002BuildNoticeDocx({
      module002TemplateFile,
      module002Mapping: {
        title: 7,
        recipient: 9,
        explanation: 10,
        topics: 11,
        attire: 12,
        signatureDate: 22,
      },
      module002Content: {
        title: "关于召开第三党支部党员大会的通知",
        recipient: "第三党支部全体党员：",
        explanation: "拟于2026年8月18日开展第三党支部党员大会，参会地点：第一会议室。会议议题：",
        topics: "1. 学习重要文件\n2. 研究支部事项",
        attire: "请参会党员着工装，佩戴党徽。",
        signatureDate: "2026年8月17日",
      },
    });
    const module002Xml = await module002ReadDocxXml(module002Blob);
    expect(module002Blob.type).toContain("application/vnd.openxmlformats");
    expect(module002Xml).toContain("关于召开第三党支部党员大会的通知");
    expect(module002Xml).toContain("2. 研究支部事项");
    expect(module002Xml).toContain("FF0000");
  });
});
