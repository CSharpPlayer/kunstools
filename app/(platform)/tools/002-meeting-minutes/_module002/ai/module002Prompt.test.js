import { describe, expect, it } from "vitest";
import { module002FixtureCatalog } from "../test/fixtures/module002FixtureCatalog";
import {
  module002RenderPrompt,
  module002SerializePersonCards,
  module002StandardProtocolText,
  module002ValidateAiResult,
  module002ValidatePrompt,
  module002ValidateSingleSpeechResult,
} from "./module002Prompt";

const module002Prompt = `${module002StandardProtocolText}\n{{CURRENT_DOCUMENT_BODY}}\n{{PERSON_CARDS}}`;

describe("module002 prompt and result protocol", () => {
  it("校验必需变量并安全替换", () => {
    expect(module002ValidatePrompt(module002Prompt)).toEqual([]);
    expect(
      module002RenderPrompt(module002Prompt, {
        CURRENT_DOCUMENT_BODY: "正文",
        PERSON_CARDS: "人物",
      }),
    ).toContain("正文");
  });

  it("阻止重复发言人结果", () => {
    expect(() =>
      module002ValidateAiResult({
        module002RawResult: module002FixtureCatalog.ai.duplicatePerson,
        module002Speakers: [{ id: "person-speaker", name: "测试人员乙" }],
      }),
    ).toThrow();
  });

  it("接受人物、顺序和内容都完整的固定协议", () => {
    expect(
      module002ValidateAiResult({
        module002RawResult: module002FixtureCatalog.ai.valid,
        module002Speakers: [{ id: "person-speaker", name: "测试人员乙" }],
      }),
    ).toEqual(module002FixtureCatalog.ai.valid);
  });

  it("以可见序号发送人物卡并在本地回填内部人物 ID", () => {
    const module002Speaker = {
      id: "person-internal-id",
      order: 2,
      name: "测试人员丙",
      values: { branchRole: "支部党员", businessRole: "仓储统计员" },
    };
    const module002PersonCards = module002SerializePersonCards(
      [module002Speaker],
      [
        { id: "serialNumber", label: "序号" },
        { id: "name", label: "姓名" },
        { id: "branchRole", label: "支部岗位" },
        { id: "businessRole", label: "业务岗位" },
      ],
    );

    expect(module002PersonCards).toContain("序号：3");
    expect(module002PersonCards).not.toContain("person-internal-id");
    expect(
      module002ValidateAiResult({
        module002RawResult: {
          speeches: [{ serialNumber: "3", name: "测试人员丙", content: "合成交流发言" }],
        },
        module002Speakers: [module002Speaker],
        module002IdentityField: "serialNumber",
      }),
    ).toEqual({
      speeches: [{ personId: "person-internal-id", name: "测试人员丙", content: "合成交流发言" }],
    });
  });

  it.each([
    ["缺人", []],
    ["陌生人", [{ personId: "person-stranger", name: "测试人员丙", content: "合成" }]],
    ["姓名与 ID 不一致", [{ personId: "person-speaker", name: "错误姓名", content: "合成" }]],
    ["空内容", [{ personId: "person-speaker", name: "测试人员乙", content: "" }]],
  ])("阻止%s的多人返回", (module002CaseName, module002Speeches) => {
    expect(() =>
      module002ValidateAiResult({
        module002RawResult: {
          speeches: module002Speeches,
        },
        module002Speakers: [{ id: "person-speaker", name: "测试人员乙" }],
      }),
    ).toThrow();
  });

  it("阻止截断或非 JSON 返回，并校验单人修订人物身份", () => {
    expect(() => JSON.parse(module002FixtureCatalog.ai.nonJson)).toThrow();
    expect(() => JSON.parse(module002FixtureCatalog.ai.truncatedJson)).toThrow();
    expect(() =>
      module002ValidateSingleSpeechResult(
        { personId: "person-stranger", name: "测试人员乙", content: "合成修改" },
        { id: "person-speaker", name: "测试人员乙" },
      ),
    ).toThrow("人物不一致");
  });
});
