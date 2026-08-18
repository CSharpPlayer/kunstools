import { describe, expect, it } from "vitest";
import { module002FixtureCatalog } from "../test/fixtures/module002FixtureCatalog";
import {
  module002FindCandidateParagraphs,
  module002GetSupportedFileType,
} from "./module002CandidateParagraphs";

describe("module002 deterministic paragraph selection", () => {
  it("包含 80 和 500 字边界并排除边界外段落", () => {
    const module002Paragraphs = module002FindCandidateParagraphs([
      module002FixtureCatalog.paragraphs.short,
      module002FixtureCatalog.paragraphs.boundary80,
      module002FixtureCatalog.paragraphs.boundary500,
      module002FixtureCatalog.paragraphs.tooLong,
    ]);
    expect(module002Paragraphs).toHaveLength(2);
    expect(module002Paragraphs[0]).toHaveLength(80);
    expect(module002Paragraphs[1]).toHaveLength(500);
  });

  it("只接受首版声明的文件类型", () => {
    expect(module002GetSupportedFileType("材料.DOCX")).toBe("docx");
    expect(module002GetSupportedFileType("扫描.pdf")).toBe("pdf");
    expect(module002GetSupportedFileType("照片.jpeg")).toBe("image");
    expect(module002GetSupportedFileType("旧文档.doc")).toBeNull();
  });

  it("排除跨页重复的页眉页脚段落", () => {
    const module002Repeated = "重复页眉正文".repeat(20);
    expect(
      module002FindCandidateParagraphs([
        module002Repeated,
        module002FixtureCatalog.paragraphs.normal,
        module002Repeated,
      ]),
    ).toEqual([module002FixtureCatalog.paragraphs.normal]);
  });
});
