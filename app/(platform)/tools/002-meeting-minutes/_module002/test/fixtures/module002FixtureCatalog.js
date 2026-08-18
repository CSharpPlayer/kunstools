/**
 * 不含真实人物、单位或业务内容的合成测试目录。
 * 二进制材料位于同级 binary 目录，仅用于本地自动化和人工校准。
 */
export const module002FixtureCatalog = Object.freeze({
  paragraphs: Object.freeze({
    short: "合成短段落，仅用于验证过短内容会被排除。",
    boundary80: "测".repeat(80),
    normal: "合成测试正文".repeat(24),
    boundary500: "验".repeat(500),
    tooLong: "长".repeat(501),
    heading: "一、合成测试标题",
  }),
  fileNames: Object.freeze([
    "第一议题合成材料甲.docx",
    "第一议题合成材料乙.pdf",
    "普通合成材料.png",
    "文本层多页合成材料.pdf",
    "文本层无合格段落.pdf",
    "扫描合成材料.pdf",
    "旋转合成材料.jpg",
    "模糊合成材料.png",
    "超大合成材料.png",
    "损坏材料.docx",
    "加密材料.pdf",
    "不支持材料.pdf",
    "错误扩展名.txt",
  ]),
  ai: Object.freeze({
    valid: {
      speeches: [
        {
          personId: "person-speaker",
          name: "测试人员乙",
          content: "合成交流发言。",
        },
      ],
    },
    duplicatePerson: {
      speeches: [
        { personId: "person-speaker", name: "测试人员乙", content: "一" },
        { personId: "person-speaker", name: "测试人员乙", content: "二" },
      ],
    },
    nonJson: "这不是 JSON",
    truncatedJson: '{"speeches":',
  }),
});
