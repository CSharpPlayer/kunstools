import { module002CreateId } from "./module002Factories";

/** 从文件名去除扩展名，但保留“第一议题”等业务文字。 */
export function module002TitleFromFileName(module002FileName) {
  return module002FileName.replace(/\.[^.]+$/, "");
}

/** 将文件追加到用户明确指定的议题，不根据文件名自动改投其他议题。 */
export function module002AssignFilesToTopics(
  module002Topics,
  module002TopicId,
  module002Files,
) {
  const module002NextTopics = structuredClone(module002Topics);
  const module002TargetIndex = module002NextTopics.findIndex(
    (module002Topic) => module002Topic.id === module002TopicId,
  );
  const module002TargetTopic = module002NextTopics[module002TargetIndex];
  if (!module002TargetTopic) return module002NextTopics;
  module002Files.forEach((module002File) => {
    module002TargetTopic.sources.push({ file: module002File });
  });
  const module002FirstTopicTitles = module002TargetIndex === 0
    ? module002TargetTopic.sources
      .map((module002Source) => module002Source.file.name)
      .filter((module002FileName) => module002FileName.includes("第一议题"))
      .map(module002TitleFromFileName)
    : [];
  if (module002FirstTopicTitles.length) {
    module002TargetTopic.title = module002FirstTopicTitles.join("、");
    module002TargetTopic.firstTopicLocked = true;
  } else if (!module002TargetTopic.title.trim() && module002Files[0]) {
    module002TargetTopic.title = module002TitleFromFileName(module002Files[0].name);
  }

  return module002NextTopics.map((module002Topic, module002Index) => ({
    ...module002Topic,
    order: module002Index,
  }));
}

/** 去掉全部第一议题文件后解除首位锁定。 */
export function module002RefreshFirstTopicLock(module002Topic) {
  const module002HasFirstTopicFile = module002Topic.sources.some(
    (module002Source) => module002Source.fileName?.includes("第一议题"),
  );
  return { ...module002Topic, firstTopicLocked: module002HasFirstTopicFile };
}
