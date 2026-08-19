import { describe, expect, it } from "vitest";
import { module002CreateDraft, module002CreateInitialWorkspace } from "./module002Factories";
import {
  module002BuildNoticeContent,
  module002GetNoticeSignatureDate,
} from "./module002Notice";

describe("module002 notice content", () => {
  it("避开周末与法定节假日，并且不把调休周末视为可用落款日", () => {
    expect(module002GetNoticeSignatureDate("2026-10-08")).toBe("2026-09-30");
    expect(module002GetNoticeSignatureDate("2026-01-05")).toBe("2025-12-31");
  });

  it("从当前会议信息构造动态党支部、时间、地点和编号议题", () => {
    const module002Config = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Config.templates[0],
      module002DocumentFormat: module002Config.documentFormat,
      module002People: module002Config.people,
    });
    module002Draft.meetingInfo.date = "2026-08-18";
    module002Draft.meetingInfo.time = "上午9:00";
    module002Draft.meetingInfo.location = "第一会议室";
    module002Draft.topics = [
      { id: "topic-1", title: "学习重要文件", order: 0, firstTopicLocked: false, sources: [] },
      { id: "topic-2", title: "研究支部事项", order: 1, firstTopicLocked: false, sources: [] },
    ];

    const module002Notice = module002BuildNoticeContent(module002Draft, module002Config);

    expect(module002Notice.title).toBe("关于召开第三党支部党员大会的通知");
    expect(module002Notice.recipient).toBe("第三党支部全体党员：");
    expect(module002Notice.explanation).toContain("拟于2026年8月18日 上午9:00开展");
    expect(module002Notice.explanation).toContain("参会地点：第一会议室");
    expect(module002Notice.topics).toBe("1. 学习重要文件\n2. 研究支部事项");
    expect(module002Notice.signatureDate).toBe("2026年8月17日");
  });
});
