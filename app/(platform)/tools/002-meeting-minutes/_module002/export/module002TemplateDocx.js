const module002WordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const module002XmlNamespace = "http://www.w3.org/XML/1998/namespace";
const module002NoticeMappingFields = Object.freeze([
  "title",
  "recipient",
  "explanation",
  "topics",
  "attire",
  "signatureDate",
]);

/** 解压并读取 Word 模板正文 XML，供映射、替换共用。 */
async function module002ReadWordDocumentXml(module002TemplateFile) {
  const {
    BlobReader: Module002BlobReader,
    TextWriter: Module002TextWriter,
    ZipReader: Module002ZipReader,
  } = await import("@zip.js/zip.js");
  const module002Reader = new Module002ZipReader(new Module002BlobReader(module002TemplateFile));
  try {
    const module002Entry = (await module002Reader.getEntries()).find(
      (module002Item) => module002Item.filename === "word/document.xml",
    );
    if (!module002Entry) throw new Error("通知模板缺少 Word 正文内容");
    return module002Entry.getData(new Module002TextWriter());
  } finally {
    await module002Reader.close();
  }
}

/** 从 Word 正文 XML 返回按原顺序计数的段落节点。 */
function module002GetWordParagraphNodes(module002Document) {
  const module002Bodies = module002Document.getElementsByTagNameNS(module002WordNamespace, "body");
  if (!module002Bodies.length) throw new Error("通知模板正文结构不完整");
  return Array.from(
    module002Bodies[0].getElementsByTagNameNS(module002WordNamespace, "p"),
  );
}

/** 读取一个 Word 段落中的可见文字，供映射界面显示。 */
function module002ReadWordParagraphText(module002Paragraph) {
  return Array.from(
    module002Paragraph.getElementsByTagNameNS(module002WordNamespace, "t"),
  )
    .map((module002TextNode) => module002TextNode.textContent ?? "")
    .join("");
}

/** 将指定段落的文字替换为新内容，并保留该段落的原有格式和图形。 */
function module002ReplaceWordParagraphText(module002Paragraph, module002Value) {
  const module002TextNodes = Array.from(
    module002Paragraph.getElementsByTagNameNS(module002WordNamespace, "t"),
  );
  if (!module002TextNodes.length) throw new Error("所选通知模板段落不含可替换文字");
  const module002Lines = String(module002Value).split("\n");
  const module002FirstText = module002TextNodes[0];
  const module002FirstRun = module002FirstText.parentNode;
  module002FirstText.textContent = module002Lines[0] ?? "";
  if (/^\s|\s$| {2,}/.test(module002FirstText.textContent)) {
    module002FirstText.setAttributeNS(module002XmlNamespace, "xml:space", "preserve");
  }
  module002TextNodes.slice(1).forEach((module002TextNode) => module002TextNode.remove());
  let module002InsertAfter = module002FirstRun;
  module002Lines.slice(1).forEach((module002Line) => {
    const module002Run = module002Paragraph.ownerDocument.createElementNS(
      module002WordNamespace,
      "w:r",
    );
    const module002Properties = module002FirstRun.getElementsByTagNameNS(
      module002WordNamespace,
      "rPr",
    )[0];
    if (module002Properties) module002Run.appendChild(module002Properties.cloneNode(true));
    module002Run.appendChild(
      module002Paragraph.ownerDocument.createElementNS(module002WordNamespace, "w:br"),
    );
    const module002Text = module002Paragraph.ownerDocument.createElementNS(
      module002WordNamespace,
      "w:t",
    );
    module002Text.textContent = module002Line;
    if (/^\s|\s$| {2,}/.test(module002Line)) {
      module002Text.setAttributeNS(module002XmlNamespace, "xml:space", "preserve");
    }
    module002Run.appendChild(module002Text);
    module002InsertAfter.parentNode.insertBefore(module002Run, module002InsertAfter.nextSibling);
    module002InsertAfter = module002Run;
  });
}

/** 验证通知模板六项映射均已选择、存在且没有重复指向同一段落。 */
function module002ValidateNoticeMapping(module002Paragraphs, module002Mapping) {
  const module002Indexes = module002NoticeMappingFields.map((module002Field) => {
    const module002Index = module002Mapping[module002Field];
    if (!Number.isInteger(module002Index) || module002Index < 0) {
      throw new Error("请先完成通知模板的六项段落映射");
    }
    if (!module002Paragraphs[module002Index]) {
      throw new Error("通知模板映射的段落位置已不存在，请重新设置映射");
    }
    return module002Index;
  });
  if (new Set(module002Indexes).size !== module002Indexes.length) {
    throw new Error("通知模板的六项内容不能映射到同一个段落");
  }
}

/** 列出通知模板正文段落，供用户手动选择每个业务字段的位置。 */
export async function module002ListNoticeTemplateParagraphs(module002TemplateFile) {
  const module002Xml = await module002ReadWordDocumentXml(module002TemplateFile);
  const module002Document = new DOMParser().parseFromString(module002Xml, "application/xml");
  if (module002Document.getElementsByTagName("parsererror").length) {
    throw new Error("通知模板 XML 无法读取");
  }
  return module002GetWordParagraphNodes(module002Document).map(
    (module002Paragraph, module002Index) => ({
      index: module002Index,
      text: module002ReadWordParagraphText(module002Paragraph),
    }),
  );
}

/** 在保留原有页眉、红线和版式的前提下，替换通知模板中的六段文字。 */
export async function module002BuildNoticeDocx({
  module002TemplateFile,
  module002Mapping,
  module002Content,
}) {
  const module002DocumentXml = await module002ReadWordDocumentXml(module002TemplateFile);
  const module002Document = new DOMParser().parseFromString(
    module002DocumentXml,
    "application/xml",
  );
  if (module002Document.getElementsByTagName("parsererror").length) {
    throw new Error("通知模板 XML 无法读取");
  }
  const module002Paragraphs = module002GetWordParagraphNodes(module002Document);
  module002ValidateNoticeMapping(module002Paragraphs, module002Mapping);
  module002NoticeMappingFields.forEach((module002Field) => {
    module002ReplaceWordParagraphText(
      module002Paragraphs[module002Mapping[module002Field]],
      module002Content[module002Field],
    );
  });
  const module002NextXml = new XMLSerializer().serializeToString(module002Document);
  const {
    BlobReader: Module002BlobReader,
    BlobWriter: Module002BlobWriter,
    TextReader: Module002TextReader,
    Uint8ArrayReader: Module002Uint8ArrayReader,
    Uint8ArrayWriter: Module002Uint8ArrayWriter,
    ZipReader: Module002ZipReader,
    ZipWriter: Module002ZipWriter,
  } = await import("@zip.js/zip.js");
  const module002Reader = new Module002ZipReader(new Module002BlobReader(module002TemplateFile));
  const module002Writer = new Module002ZipWriter(
    new Module002BlobWriter(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  );
  try {
    const module002Entries = await module002Reader.getEntries();
    for (const module002Entry of module002Entries) {
      if (module002Entry.directory) continue;
      const module002Data = module002Entry.filename === "word/document.xml"
        ? new Module002TextReader(module002NextXml)
        : new Module002Uint8ArrayReader(
            await module002Entry.getData(new Module002Uint8ArrayWriter()),
          );
      await module002Writer.add(module002Entry.filename, module002Data);
    }
    return module002Writer.close();
  } finally {
    await module002Reader.close();
  }
}
