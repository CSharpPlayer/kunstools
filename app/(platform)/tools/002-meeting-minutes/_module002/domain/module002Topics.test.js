import { describe, expect, it } from "vitest";
import { module002AssignFilesToTopics } from "./module002Topics";

describe("module002 topic single source rules", () => {
  it("第一议题将多份第一议题材料的文件名合并为标题", () => {
    const module002Topics = module002AssignFilesToTopics([
      { id: "topic-1", title: "", order: 0, firstTopicLocked: false, sources: [] },
    ], "topic-1", [
      { name: "第一议题材料甲.docx" },
      { name: "第一议题材料乙.pdf" },
    ]);

    expect(module002Topics[0].title).toBe("第一议题材料甲、第一议题材料乙");
    expect(module002Topics[0].firstTopicLocked).toBe(true);
  });

  it("文件只会追加到用户指定的议题", () => {
    const module002Topics = module002AssignFilesToTopics([
      { id: "topic-1", title: "议题一", order: 0, firstTopicLocked: false, sources: [] },
      { id: "topic-2", title: "", order: 1, firstTopicLocked: false, sources: [] },
      { id: "topic-3", title: "议题三", order: 2, firstTopicLocked: false, sources: [] },
    ], "topic-2", [
      { name: "第一议题材料甲.pdf" },
      { name: "材料乙.png" },
    ]);

    expect(module002Topics.map((module002Topic) => module002Topic.sources.length)).toEqual([0, 2, 0]);
    expect(module002Topics[1].title).toBe("第一议题材料甲");
    expect(module002Topics[1].firstTopicLocked).toBe(false);
  });
});
