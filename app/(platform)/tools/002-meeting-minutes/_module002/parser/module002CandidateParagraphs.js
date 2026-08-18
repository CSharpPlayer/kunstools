const module002MinimumParagraphLength = 80;
const module002MaximumParagraphLength = 500;

/** 按中文正文习惯计算候选长度，忽略纯排版空白。 */
export function module002CountParagraphCharacters(module002Text) {
  return module002Text.replace(/[\s\u00a0]+/g, "").length;
}

/** 判断一段文字是否像标题、目录、编号或表格噪声。 */
export function module002IsParagraphNoise(module002Text) {
  const module002Trimmed = module002Text.trim();

  if (!module002Trimmed) return true;
  if (/^第?[一二三四五六七八九十\d]+[章节条、.．：:]?\s*[^，。！？]{0,28}$/.test(module002Trimmed)) {
    return true;
  }
  if (/^目录$|^目\s*录$/.test(module002Trimmed)) return true;
  if (/^[\d一二三四五六七八九十（）()、.．\-—\s]+$/.test(module002Trimmed)) return true;
  if ((module002Trimmed.match(/[|｜\t]/g) ?? []).length >= 3) return true;
  if (/[…\.]{4,}\s*\d+$/.test(module002Trimmed)) return true;
  return false;
}

/** 确定性返回所有合格完整段落，保持原文字面内容和顺序。 */
export function module002FindCandidateParagraphs(module002Paragraphs) {
  const module002Frequency = new Map();
  module002Paragraphs.forEach((module002Paragraph) => {
    const module002Normalized = module002Paragraph.trim();
    module002Frequency.set(
      module002Normalized,
      (module002Frequency.get(module002Normalized) ?? 0) + 1,
    );
  });

  return module002Paragraphs.filter((module002Paragraph) => {
    const module002Count = module002CountParagraphCharacters(module002Paragraph);
    const module002Normalized = module002Paragraph.trim();
    const module002Valid =
      module002Count >= module002MinimumParagraphLength &&
      module002Count <= module002MaximumParagraphLength &&
      !module002IsParagraphNoise(module002Paragraph) &&
      module002Frequency.get(module002Normalized) === 1;
    return module002Valid;
  });
}

/** 选择阅读顺序中的第一个合格段落，找不到时返回空值。 */
export function module002SelectFirstCandidate(module002Paragraphs) {
  return module002FindCandidateParagraphs(module002Paragraphs)[0] ?? null;
}

/** 从常见文档换行中恢复独立正文段落。 */
export function module002SplitParagraphText(module002Text) {
  return module002Text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=\s{0,4}(?:第?[一二三四五六七八九十\d]+[、.．]|[^\n]{80,}))/)
    .map((module002Paragraph) => module002Paragraph.trim())
    .filter(Boolean);
}

/** 根据文件扩展名返回首版支持的解析类型。 */
export function module002GetSupportedFileType(module002FileName) {
  const module002Extension = module002FileName.split(".").pop()?.toLowerCase();
  if (module002Extension === "docx") return "docx";
  if (module002Extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png"].includes(module002Extension)) return "image";
  return null;
}
