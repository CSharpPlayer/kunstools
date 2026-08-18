// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { module002ParseSourceFile } from "./module002FileParser";

const module002FixtureDirectory = path.join(
  process.cwd(),
  "app/(platform)/tools/002-meeting-minutes/_module002/test/fixtures/binary",
);

/** 把仓库内的合成二进制材料包装为浏览器 File。 */
async function module002ReadFixture(module002Name, module002Type) {
  const module002Bytes = await readFile(
    path.join(module002FixtureDirectory, module002Name),
  );
  return {
    name: module002Name,
    type: module002Type,
    size: module002Bytes.byteLength,
    arrayBuffer: async () => module002Bytes.buffer.slice(
      module002Bytes.byteOffset,
      module002Bytes.byteOffset + module002Bytes.byteLength,
    ),
  };
}

describe("module002 DOCX parser integration", () => {
  it("从真实 DOCX 包提取 80、普通和 500 字符候选段落", async () => {
    const module002Result = await module002ParseSourceFile({
      module002File: await module002ReadFixture(
        "第一议题合成材料甲.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    });
    expect(module002Result.fileType).toBe("docx");
    expect(module002Result.candidates.map((module002Text) => module002Text.length)).toEqual([
      80,
      108,
      500,
    ]);
    expect(module002Result.selectedText).toHaveLength(80);
  });

  it("损坏 DOCX 返回可恢复失败而不是伪造正文", async () => {
    const module002File = await module002ReadFixture(
      "损坏材料.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await expect(
      module002ParseSourceFile({ module002File }),
    ).rejects.toThrow();
  });
});
