const module002UniqueModuleTypes = new Set([
  "mainTitle",
  "meetingSummary",
  "topicSummary",
  "hostOpening",
  "topicDetails",
  "groupSpeeches",
  "hostClosing",
]);

/** 返回模板结构中需要用户修复的依赖和唯一性问题。 */
export function module002ValidateTemplateModules(module002Modules) {
  const module002Errors = [];
  const module002TypeCount = new Map();

  module002Modules.forEach((module002Module) => {
    module002TypeCount.set(
      module002Module.type,
      (module002TypeCount.get(module002Module.type) ?? 0) + 1,
    );
  });

  module002UniqueModuleTypes.forEach((module002Type) => {
    if ((module002TypeCount.get(module002Type) ?? 0) > 1) {
      module002Errors.push(`“${module002Type}”属于唯一模块，不能重复添加。`);
    }
  });

  if (module002TypeCount.has("topicDetails") && !module002TypeCount.has("topicSummary")) {
    module002Errors.push("会议详细记录依赖议题说明，请先添加议题说明。 ");
  }
  if (module002TypeCount.has("hostOpening") && !module002TypeCount.has("meetingSummary")) {
    module002Errors.push("主持人开头发言依赖会议情况说明，请先添加会议情况说明。 ");
  }
  if (module002TypeCount.has("groupSpeeches") && !module002TypeCount.has("meetingSummary")) {
    module002Errors.push("全体交流发言依赖会议情况说明，请先添加会议情况说明。 ");
  }
  if (module002TypeCount.has("hostClosing") && !module002TypeCount.has("groupSpeeches")) {
    module002Errors.push("主持人总结发言依赖全体交流发言，请先添加全体交流发言。 ");
  }

  return module002Errors;
}

/** 判断删除指定模块后模板是否仍满足结构约束。 */
export function module002CanRemoveTemplateModule(
  module002Modules,
  module002ModuleId,
) {
  const module002NextModules = module002Modules.filter(
    (module002Module) => module002Module.id !== module002ModuleId,
  );
  return {
    allowed: module002ValidateTemplateModules(module002NextModules).length === 0,
    errors: module002ValidateTemplateModules(module002NextModules),
  };
}
