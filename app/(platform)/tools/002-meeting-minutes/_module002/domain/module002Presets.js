/** 第三党支部党员大会默认 AI Prompt，使用人物卡可见序号而非内部人物 ID。 */
export const module002ThirdBranchPartyCongressDefaultPrompt = `【任务说明】
请基于下方提供的中储粮宁江直属库第三党支部党员大会议题材料与会议详细记录，为指定人员分别生成学习心得体会交流发言。发言须紧密结合会议传达的学习内容，并贴合发言者的支部岗位、业务岗位实际，全程围绕思想认识、学习感悟展开，不得涉及未来工作规划与打算。

【写作规范】
（1）内容边界：仅阐述对会议学习内容的理解、思想层面的收获与感悟；严禁出现“今后我将”“下一步要”“未来打算”“工作计划”等面向未来的表述。
（2）表述禁忌：严禁使用“作为一名XX”“身为XX岗位人员”等身份代入式句式；严禁使用比喻修辞和非必要双引号，避免口语化、通俗化表达。
（3）业务贴合：须结合中储粮粮食储备核心业务属性及人物卡中的具体岗位，从本人工作视角谈体会，避免空泛理论堆砌和泛泛表态。
（4）行文要求：语言严谨平实、正式规范，符合国企基层党支部党员发言语境；优先使用“以……”句式整合表述，合并冗余长句，行文凝练顺畅。
（5）字数控制：若人物卡中设置了字数要求字段，实际字数与要求字数的误差控制在 10% 以内；未设置时不自行编造字数要求。
（6）主持人：主持人的固定开头和固定总结由系统生成；此处仅生成其普通交流环节的心得发言，规则与其他发言人员一致。

【人物卡使用规则】
- 人物卡中的“序号”是本次返回与回填的唯一对应依据，必须原样保留。
- 按人物卡所列序号从小到大输出全部指定人员的发言，不得遗漏、增添、合并或调换人员。

【输出格式】
- 仅输出一个 JSON 对象，不得添加 Markdown、说明文字、开场语、过渡语或总结语。
- 严格使用以下字段和层级：
{
  "speeches": [{"serialNumber":"人物卡序号","name":"姓名","content":"该人员的交流发言正文"}]
}
- content 仅填写该人员的完整交流发言正文。

【发言人员】
{{PERSON_CARDS}}

【本次党员大会议题材料与会议详细记录】
{{CURRENT_DOCUMENT_BODY}}`;

/** 第三党支部首版人物卡的固定业务数据；序号由人物卡的显示顺序产生。 */
export const module002ThirdBranchPresetPeople = Object.freeze([
  Object.freeze({ name: "李万庄", branchRole: "支部书记", businessRole: "分库总经理" }),
  Object.freeze({ name: "李风华", branchRole: "支部纪检委员", businessRole: "分库仓储负责人" }),
  Object.freeze({ name: "牛井奎", branchRole: "支部宣传、青年、组织委员", businessRole: "分库综合负责人" }),
  Object.freeze({ name: "赵志国", branchRole: "支部党员", businessRole: "安全员" }),
  Object.freeze({ name: "陈国辉", branchRole: "支部党员", businessRole: "食堂管理员" }),
  Object.freeze({ name: "王云松", branchRole: "支部党员", businessRole: "仓储班组长" }),
  Object.freeze({ name: "许艳杰", branchRole: "支部党员", businessRole: "仓储统计员" }),
  Object.freeze({ name: "李翔鲲", branchRole: "支部党员", businessRole: "网管员兼党务人员" }),
]);
