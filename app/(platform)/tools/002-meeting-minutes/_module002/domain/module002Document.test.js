import { describe, expect, it } from "vitest";
import {
  module002BuildDocumentBlocks,
  module002FormatTopicDetailOrdinal,
  module002GetOrderedSpeakers,
} from "./module002Document";
import {
  module002CreateDraft,
  module002CreateInitialWorkspace,
} from "./module002Factories";

describe("module002 document blocks", () => {
  it("将详细记录议题生成为黑体二级标题语义和中文序号", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.topics = [
      {
        id: "topic-1",
        title: "学习专题",
        order: 0,
        firstTopicLocked: false,
        sources: [{ selectedText: "第一段材料" }],
      },
      {
        id: "topic-2",
        title: "交流专题",
        order: 1,
        firstTopicLocked: false,
        sources: [{ selectedText: "第二段材料" }],
      },
    ];
    const module002Details = module002BuildDocumentBlocks(
      module002Draft,
      module002Workspace,
    ).find((module002Block) => module002Block.moduleType === "topicDetails");

    expect(module002FormatTopicDetailOrdinal(0)).toBe("一");
    expect(module002FormatTopicDetailOrdinal(10)).toBe("十一");
    expect(module002Details.text).toBe(
      "一、学习专题\n第一段材料\n二、交流专题\n第二段材料",
    );
    expect(module002Details.editorJson.content[0].attrs).toEqual({
      module002TopicDetailTitle: true,
    });
    expect(module002Details.editorJson.content[1].attrs).toEqual({});
  });

  it("按人物卡序号安排普通发言，并在首尾生成主持人固定发言", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002BranchId = module002Workspace.templates[0].branchId;
    module002Workspace.people = [
      { id: "person-1", branchId: module002BranchId, order: 0, name: "人员甲", values: {}, isExample: false },
      { id: "person-2", branchId: module002BranchId, order: 1, name: "主持人乙", values: {}, isExample: false },
      { id: "person-3", branchId: module002BranchId, order: 2, name: "人员丙", values: {}, isExample: false },
    ];
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: module002Workspace.people,
    });
    module002Draft.meetingInfo.hostPersonId = "person-2";
    module002Draft.speakerPersonIds = ["person-3", "person-1"];
    module002Draft.speeches = {
      "person-1": "人员甲普通发言。",
      "person-2": "主持人乙普通发言。",
      "person-3": "人员丙普通发言。",
    };
    const module002Blocks = module002BuildDocumentBlocks(module002Draft, module002Workspace);

    expect(module002GetOrderedSpeakers(module002Draft, module002Workspace).map((item) => item.id)).toEqual([
      "person-1",
      "person-2",
      "person-3",
    ]);
    expect(module002Blocks.find((item) => item.moduleType === "hostOpening")?.text).toBe(
      "主持人乙，根据以上议题内容，请同志们简单进行一下交流发言。",
    );
    expect(module002Blocks.find((item) => item.moduleType === "groupSpeeches")?.text).toBe(
      "人员甲：人员甲普通发言。\n主持人乙：主持人乙普通发言。\n人员丙：人员丙普通发言。",
    );
    expect(module002Blocks.find((item) => item.moduleType === "hostClosing")?.text).toBe(
      "主持人乙，今天的支部大会，议题就这么多，散会！",
    );
  });

  it("将时间与地点标记为同一行两端对齐的正文结构", () => {
    const module002Workspace = module002CreateInitialWorkspace();
    const module002Draft = module002CreateDraft({
      module002Template: module002Workspace.templates[0],
      module002DocumentFormat: module002Workspace.documentFormat,
      module002People: [],
    });
    module002Draft.meetingInfo.time = "上午 9:00";
    module002Draft.meetingInfo.location = "会议室";
    const module002Summary = module002BuildDocumentBlocks(
      module002Draft,
      module002Workspace,
    ).find((module002Block) => module002Block.moduleType === "meetingSummary");

    expect(module002Summary.text).toContain("\t地点：会议室");
    expect(module002Summary.editorJson.content[1].attrs).toEqual({
      module002MeetingTimeLocation: true,
    });
    expect(module002Summary.editorJson.content[1].content.map((item) => item.type)).toEqual([
      "text",
      "module002MeetingTimeLocationSpacer",
      "text",
    ]);
    expect(module002Summary.editorJson.content[1].content[0].text).toContain("时间：");
    expect(module002Summary.editorJson.content[1].content[2].text).toBe("地点：会议室");
  });
});
