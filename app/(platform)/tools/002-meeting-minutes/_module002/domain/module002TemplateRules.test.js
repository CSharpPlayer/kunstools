import { describe, expect, it } from "vitest";
import { module002ValidateTemplateModules } from "./module002TemplateRules";

describe("module002 template dependency rules", () => {
  it("阻止重复唯一模块", () => {
    const module002Errors = module002ValidateTemplateModules([
      { type: "mainTitle" },
      { type: "mainTitle" },
    ]);
    expect(module002Errors.some((item) => item.includes("不能重复"))).toBe(true);
  });

  it("阻止没有议题说明的详细记录", () => {
    const module002Errors = module002ValidateTemplateModules([
      { type: "topicDetails" },
    ]);
    expect(module002Errors.some((item) => item.includes("依赖议题说明"))).toBe(true);
  });
});
