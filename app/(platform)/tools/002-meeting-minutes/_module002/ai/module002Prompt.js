import {
  module002AiResultSchema,
  module002SingleSpeechResultSchema,
} from "../domain/module002Schemas";

export const module002RequiredPromptVariables = Object.freeze([
  "{{CURRENT_DOCUMENT_BODY}}",
  "{{PERSON_CARDS}}",
]);

/** 识别当前 Prompt 使用的人物回填键，兼容旧版人物 ID 协议。 */
export function module002GetPromptIdentityField(module002Prompt) {
  return module002Prompt.includes('"serialNumber"')
    ? "serialNumber"
    : "personId";
}

/** 返回对应回填键的固定 JSON 协议说明。 */
export function module002GetStandardProtocolText(
  module002IdentityField = "serialNumber",
) {
  const module002IdentifierExample = module002IdentityField === "serialNumber"
    ? "人物卡序号"
    : "stable-person-id";
  return `请仅输出 json 对象，并严格使用以下字段和层级：
{
  "speeches": [{"${module002IdentityField}":"${module002IdentifierExample}","name":"姓名","content":"普通交流发言"}]
}`;
}

export const module002StandardProtocolText = module002GetStandardProtocolText();

/** 检查 Prompt 中必需变量和固定协议字段是否完好。 */
export function module002ValidatePrompt(module002Prompt) {
  const module002Errors = [];
  module002RequiredPromptVariables.forEach((module002Variable) => {
    if (!module002Prompt.includes(module002Variable)) {
      module002Errors.push(`缺少必需变量 ${module002Variable}`);
    }
  });
  [
    module002GetPromptIdentityField(module002Prompt),
    "name",
    "content",
    "speeches",
  ].forEach(
    (module002Field) => {
      if (!module002Prompt.includes(`"${module002Field}"`)) {
        module002Errors.push(`固定 JSON 协议缺少字段 “${module002Field}”`);
      }
    },
  );
  return module002Errors;
}

/** 只做固定变量替换，不执行表达式、HTML 或脚本。 */
export function module002RenderPrompt(module002Prompt, module002Variables) {
  return module002RequiredPromptVariables.reduce(
    (module002Rendered, module002Variable) =>
      module002Rendered.split(module002Variable).join(
        module002Variables[module002Variable.slice(2, -2)] ?? "",
      ),
    module002Prompt,
  );
}

/** 把人物非空字段转换为带字段名的纯文字。 */
export function module002SerializePersonCards(
  module002People,
  module002PersonFields,
  module002IdentityField = "serialNumber",
) {
  return module002People
    .map((module002Person) => {
      const module002Identifier = module002IdentityField === "serialNumber"
        ? `序号：${module002Person.order + 1}`
        : `人物ID：${module002Person.id}`;
      const module002Lines = [module002Identifier, `姓名：${module002Person.name}`];
      module002PersonFields
        .filter((module002Field) => !["serialNumber", "name"].includes(module002Field.id))
        .forEach((module002Field) => {
          const module002Value = module002Person.values[module002Field.id]?.trim();
          if (module002Value) module002Lines.push(`${module002Field.label}：${module002Value}`);
        });
      return module002Lines.join("\n");
    })
    .join("\n\n");
}

/** 取得人物在当前协议中的稳定回填标识。 */
export function module002GetPersonPromptIdentifier(
  module002Person,
  module002IdentityField = "serialNumber",
) {
  return module002IdentityField === "serialNumber"
    ? String(module002Person.order + 1)
    : module002Person.id;
}

/** 整体验证多人返回结果，失败时绝不返回部分可回填数据。 */
export function module002ValidateAiResult({
  module002RawResult,
  module002Speakers,
  module002IdentityField = "personId",
}) {
  const module002Parsed = module002AiResultSchema.parse(module002RawResult);
  const module002ExpectedIdentifiers = module002Speakers.map((module002Person) =>
    module002GetPersonPromptIdentifier(module002Person, module002IdentityField),
  );
  const module002ActualIdentifiers = module002Parsed.speeches.map(
    (module002Speech) => module002Speech[module002IdentityField],
  );

  if (new Set(module002ActualIdentifiers).size !== module002ActualIdentifiers.length) {
    throw new Error("返回结果中存在重复发言人");
  }
  if (
    module002ActualIdentifiers.length !== module002ExpectedIdentifiers.length ||
    module002ActualIdentifiers.some(
      (module002Identifier, module002Index) =>
        module002Identifier !== module002ExpectedIdentifiers[module002Index],
    )
  ) {
    throw new Error("返回的发言人或顺序与本次选择不一致");
  }
  module002Parsed.speeches.forEach((module002Speech, module002Index) => {
    if (module002Speech.name !== module002Speakers[module002Index].name) {
      throw new Error("返回结果中的人物 ID 与姓名不一致");
    }
  });
  return {
    speeches: module002Parsed.speeches.map((module002Speech, module002Index) => ({
      personId: module002Speakers[module002Index].id,
      name: module002Speech.name,
      content: module002Speech.content,
    })),
  };
}

/** 校验单人修订固定协议。 */
export function module002ValidateSingleSpeechResult(
  module002RawResult,
  module002Person,
  module002IdentityField = "personId",
) {
  const module002Parsed = module002SingleSpeechResultSchema.parse(module002RawResult);
  if (
    module002Parsed[module002IdentityField] !==
      module002GetPersonPromptIdentifier(module002Person, module002IdentityField) ||
    module002Parsed.name !== module002Person.name
  ) {
    throw new Error("单人修订返回的人物不一致");
  }
  return {
    personId: module002Person.id,
    name: module002Parsed.name,
    content: module002Parsed.content,
  };
}
