import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const module002DocxFixturePath = path.join(
  process.cwd(),
  "app/(platform)/tools/002-meeting-minutes/_module002/test/fixtures/binary/第一议题合成材料甲.docx",
);
const module002TextPdfFixturePath = path.join(
  process.cwd(),
  "app/(platform)/tools/002-meeting-minutes/_module002/test/fixtures/binary/文本层多页合成材料.pdf",
);
const module002ImageFixturePath = path.join(
  process.cwd(),
  "app/(platform)/tools/002-meeting-minutes/_module002/test/fixtures/binary/普通合成材料.png",
);

/** 使用浏览器原生 OPFS 代替系统目录弹窗，覆盖真实文件句柄读写。 */
async function module002InstallTestWorkspace(page) {
  await page.addInitScript(() => {
    let module002Prepared = false;
    window.showDirectoryPicker = async () => {
      const module002Root = await navigator.storage.getDirectory();
      if (!module002Prepared) {
        for await (const [module002Name] of module002Root.entries()) {
          await module002Root.removeEntry(module002Name, { recursive: true });
        }
        module002Prepared = true;
      }
      if (typeof module002Root.queryPermission !== "function") {
        Object.defineProperty(module002Root, "queryPermission", {
          configurable: true,
          value: async () => "granted",
        });
      }
      if (typeof module002Root.requestPermission !== "function") {
        Object.defineProperty(module002Root, "requestPermission", {
          configurable: true,
          value: async () => "granted",
        });
      }
      window.__module002TestWorkspaceHandle = module002Root;
      return module002Root;
    };
    window.showSaveFilePicker = async () => {
      const module002Root =
        window.__module002TestWorkspaceHandle ??
        (await navigator.storage.getDirectory());
      window.__module002TestWorkspaceHandle = module002Root;
      return module002Root.getFileHandle("module002-export.docx", {
        create: true,
      });
    };
  });
}

/** 只通过主页选择一次共享根目录，再进入模块。 */
async function module002EnterSharedWorkspace(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "选择文件夹" }).click();
  await expect(page.getByRole("button", { name: "更换文件夹" })).toBeVisible();
  await page.goto("/tools/002-meeting-minutes");
}

/** 模拟固定协议 DeepSeek，兼容人物 ID 与可见序号两种回填键。 */
async function module002InstallAiMock(page) {
  await page.route("**/tools/002-meeting-minutes/api/deepseek", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          models: ["deepseek-v4-flash", "deepseek-v4-pro"],
          configured: true,
        }),
      });
      return;
    }
    const module002Payload = route.request().postDataJSON();
    const module002IdentityField = module002Payload.prompt.includes('"serialNumber"')
      ? "serialNumber"
      : "personId";
    const module002People = Array.from(
      module002Payload.prompt.matchAll(/(?:人物ID|序号)：([^\n]+)\n姓名：([^\n]+)/g),
      (module002Match) => ({
        identifier: module002Match[1].trim(),
        name: module002Match[2].trim(),
      }),
    );
    const module002UniquePeople = Array.from(
      new Map(module002People.map((module002Person) => [
        module002Person.identifier,
        module002Person,
      ])).values(),
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        content: JSON.stringify({
          speeches: module002UniquePeople.map((module002Person, module002Index) => ({
            [module002IdentityField]: module002Person.identifier,
            name: module002Person.name,
            content: `合成交流发言 ${module002Index + 1}，内容仅用于自动化验证。`,
          })),
        }),
      }),
    });
  });
}

test("002 可完成本地工作区、材料解析、模拟生成、编辑和两次 Word 导出", async ({ page }, testInfo) => {
  const module002ConsoleErrors = [];
  const module002UnexpectedRequests = [];
  page.on("console", (module002Message) => {
    if (module002Message.type() === "error") {
      module002ConsoleErrors.push(module002Message.text());
    }
  });
  page.on("request", (module002Request) => {
    const module002Url = new URL(module002Request.url());
    if (!["localhost", "127.0.0.1"].includes(module002Url.hostname)) {
      module002UnexpectedRequests.push(module002Url.origin + module002Url.pathname);
    }
  });

  await module002InstallTestWorkspace(page);
  await module002InstallAiMock(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await module002EnterSharedWorkspace(page);
  await expect(page).toHaveTitle(/002 党建会议记录辅助生成工具/);
  await expect(page.getByRole("button", {
    name: "002 党建会议记录辅助生成工具",
    exact: true,
  })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "人物卡" })).toBeVisible();

  await page.getByRole("button", { name: "配置党支部模板" }).click();
  const module002ConfigDialog = page.getByRole("dialog", { name: "配置党支部模板" });
  await module002ConfigDialog.getByLabel("党支部").selectOption({ label: "第三党支部" });
  const module002TemplateNameInput = module002ConfigDialog.getByLabel("模板名称");
  await module002TemplateNameInput.fill("");
  await module002TemplateNameInput.pressSequentially("TemplateName", { delay: 5 });
  await expect(module002TemplateNameInput).toHaveValue("TemplateName");
  await expect(module002TemplateNameInput).toBeFocused();
  await module002TemplateNameInput.fill("党员大会");
  await module002ConfigDialog.getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "人物卡" }).click();
  const module002PeopleDialog = page.getByRole("dialog", { name: "人物卡" });
  await module002PeopleDialog.getByRole("tab", { name: "第三党支部" }).click();
  await expect(module002PeopleDialog.locator("tbody tr")).toHaveCount(8);
  await expect(module002PeopleDialog.locator("tbody tr").nth(0).locator("input").nth(0)).toHaveValue("李万庄");
  await expect(module002PeopleDialog.locator("tbody tr").nth(7).locator("input").nth(0)).toHaveValue("李翔鲲");
  await module002PeopleDialog.getByRole("button", { name: "新增人物" }).click();
  await module002PeopleDialog.getByRole("button", { name: "新增人物" }).click();
  const module002Rows = module002PeopleDialog.locator("tbody tr");
  const module002FirstNameInput = module002Rows.nth(8).locator("input").nth(0);
  await module002FirstNameInput.fill("");
  await module002FirstNameInput.pressSequentially("PersonAlpha", { delay: 5 });
  await expect(module002FirstNameInput).toHaveValue("PersonAlpha");
  await expect(module002FirstNameInput).toBeFocused();
  await module002FirstNameInput.fill("测试人员甲");
  const module002FirstRoleInput = module002Rows.nth(8).locator("input").nth(1);
  await module002FirstRoleInput.fill("");
  await module002FirstRoleInput.pressSequentially("BranchSecretary", { delay: 5 });
  await expect(module002FirstRoleInput).toHaveValue("BranchSecretary");
  await expect(module002FirstRoleInput).toBeFocused();
  await module002FirstRoleInput.fill("支部书记");
  await module002Rows.nth(9).locator("input").nth(0).fill("测试人员乙");
  await module002Rows.nth(9).locator("input").nth(1).fill("组织委员");
  const module002NewFieldInput = module002PeopleDialog.getByPlaceholder("新字段名称");
  await module002NewFieldInput.pressSequentially("CustomNotes", { delay: 5 });
  await expect(module002NewFieldInput).toHaveValue("CustomNotes");
  await expect(module002NewFieldInput).toBeFocused();
  await module002NewFieldInput.fill("合成备注");
  await module002PeopleDialog.getByLabel("新字段类型").selectOption("multiLine");
  await module002PeopleDialog.getByRole("button", { name: "添加字段列" }).click();
  const module002FirstNotesInput = module002Rows.nth(8).locator("textarea");
  await module002FirstNotesInput.pressSequentially("NoteAlpha", { delay: 5 });
  await expect(module002FirstNotesInput).toHaveValue("NoteAlpha");
  await expect(module002FirstNotesInput).toBeFocused();
  const module002PasteAnchor = module002Rows.nth(8).locator("input").nth(2);
  await module002PasteAnchor.focus();
  await module002PasteAnchor.evaluate((module002Input) => {
    const module002Clipboard = new DataTransfer();
    module002Clipboard.setData("text/plain", "业务甲\t合成备注甲\n业务乙\t合成备注乙");
    module002Input.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: module002Clipboard,
    }));
  });
  await expect(module002Rows.nth(8).locator("textarea")).toHaveValue("合成备注甲");
  await expect(module002Rows.nth(9).locator("textarea")).toHaveValue("合成备注乙");
  page.once("dialog", (module002Dialog) => module002Dialog.accept());
  await module002PeopleDialog.getByRole("button", { name: "删除字段 合成备注" }).click();
  await expect(module002PeopleDialog.getByRole("button", { name: "删除字段 合成备注" })).toHaveCount(0);
  await expect(module002Rows.nth(8).locator("textarea")).toHaveCount(0);
  await module002PeopleDialog.getByRole("button", { name: "上移 测试人员乙" }).click();
  await expect(module002Rows.nth(8).locator("input").nth(0)).toHaveValue("测试人员乙");
  await module002PeopleDialog.getByRole("button", { name: "下移 测试人员乙" }).click();
  await module002PeopleDialog.getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "选择党支部模板" }).click();
  const module002TemplateDialog = page.getByRole("dialog", { name: "选择党支部模板" });
  await module002TemplateDialog.getByRole("button", { name: "党员大会" }).click();
  await expect(page.locator('[data-module-type="mainTitle"]')).toBeVisible();
  await page.getByRole("button", { name: "+ 添加第一个议题" }).click();

  await page.getByLabel("具体时间").fill("上午9:00");
  const module002LocationInput = page.getByLabel("地点");
  await module002LocationInput.pressSequentially("MeetingRoom", { delay: 5 });
  await expect(module002LocationInput).toHaveValue("MeetingRoom");
  await expect(module002LocationInput).toBeFocused();
  await module002LocationInput.fill("合成测试会议室");
  const module002TimeLocationLine = page.locator(
    '[data-module-type="meetingSummary"] p[data-module002-meeting-time-location="true"]',
  );
  await expect(module002TimeLocationLine).toHaveCSS("display", "flex");
  await expect(
    module002TimeLocationLine.locator(
      '[data-module002-meeting-time-location-spacer="true"]',
    ),
  ).toHaveCount(1);
  await page.locator("label", { hasText: "主持人" }).locator("select").selectOption({ label: "测试人员甲" });
  await page.locator("label", { hasText: "记录人" }).locator("select").selectOption({ label: "测试人员乙" });
  await page.getByLabel("第 1 个议题上传材料").setInputFiles(
    module002DocxFixturePath,
  );
  await expect(page.getByText("已选段", { exact: true })).toBeVisible();
  await expect(page.getByText("第一议题锁定", { exact: true })).toBeVisible();
  const module002TopicTitleInput = page.getByLabel("第 1 个议题标题");
  await module002TopicTitleInput.fill("");
  await module002TopicTitleInput.pressSequentially("TopicAlpha", { delay: 5 });
  await expect(module002TopicTitleInput).toHaveValue("TopicAlpha");
  await expect(module002TopicTitleInput).toBeFocused();
  await module002TopicTitleInput.fill("第一议题合成材料甲");

  await page.getByRole("button", { name: /发言设置/ }).click();
  const module002Prompt = `这是合成自动化业务规则，仅用于测试。\n请仅输出 json：\n{"speeches":[{"personId":"stable-person-id","name":"姓名","content":"交流发言"}]}\n正文：{{CURRENT_DOCUMENT_BODY}}\n人物：{{PERSON_CARDS}}`;
  const module002PromptInput = page.getByLabel("完整 Prompt");
  await expect(module002PromptInput).toHaveValue(/"serialNumber"/);
  const module002RequestPreview = page.locator(".module002RequestPreview");
  await module002RequestPreview.locator("summary").click();
  await expect(module002RequestPreview).toContainText("序号：1");
  await expect(module002RequestPreview).not.toContainText("人物ID：");
  await module002PromptInput.fill("");
  await module002PromptInput.pressSequentially("PromptAlpha", { delay: 5 });
  await expect(module002PromptInput).toHaveValue("PromptAlpha");
  await expect(module002PromptInput).toBeFocused();
  await module002PromptInput.fill(module002Prompt);
  const module002GenerateButton = page.getByRole("button", { name: "生成全部发言" });
  await expect(module002GenerateButton).toBeEnabled();
  await module002GenerateButton.click();
  await expect(page.getByText("全部发言已生成并通过人员协议校验")).toBeVisible();

  const module002SpeechEditor = page.locator(
    '[data-module-type="groupSpeeches"] .module002ProseMirror',
  );
  await expect(module002SpeechEditor).toContainText("测试人员甲");
  await expect(module002SpeechEditor).toContainText("测试人员乙");
  await expect(page.locator('[data-module-type="hostOpening"] .module002ProseMirror')).toContainText("根据以上议题内容，请同志们简单进行一下交流发言。");
  await expect(page.locator('[data-module-type="hostClosing"] .module002ProseMirror')).toContainText("今天的支部大会，议题就这么多，散会！");
  await expect(page.locator('[data-module-type="meetingSummary"] p[data-module002-meeting-time-location="true"]')).toHaveCount(1);

  const module002ExportButton = page.getByRole("button", { name: "导出Word" });
  await expect(module002ExportButton).toBeEnabled();
  await module002ExportButton.click();
  await expect(page.getByText("Word 已保存；当前草稿继续保留")).toBeVisible();
  const module002FirstExportSize = await page.evaluate(async () => {
    const module002Handle = await window.__module002TestWorkspaceHandle.getFileHandle(
      "module002-export.docx",
    );
    return (await module002Handle.getFile()).size;
  });
  expect(module002FirstExportSize).toBeGreaterThan(1000);

  await module002SpeechEditor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" 已人工修订");
  await expect(page.getByText("内容已变更，需要重新导出", { exact: true })).toBeVisible();
  await module002ExportButton.click();
  await expect(page.getByText("Word 已保存；当前草稿继续保留")).toBeVisible();

  await page.locator(".module002PaperScroller").evaluate((module002Element) => {
    module002Element.scrollTop = 0;
  });
  await page.locator(".module002RightScroll").evaluate((module002Element) => {
    module002Element.scrollTop = 0;
  });
  const module002Screenshot1366 = await page.screenshot({
    path: path.join(process.cwd(), ".tmp", `module002-${testInfo.project.name}-1366x768.png`),
  });
  await testInfo.attach("module002-1366x768.png", {
    body: module002Screenshot1366,
    contentType: "image/png",
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator(".module002MainPane")).toBeVisible();
  await expect(page.locator(".module002RightPanel")).toBeVisible();
  const module002Screenshot1920 = await page.screenshot({
    path: path.join(process.cwd(), ".tmp", `module002-${testInfo.project.name}-1920x1080.png`),
  });
  await testInfo.attach("module002-1920x1080.png", {
    body: module002Screenshot1920,
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "开始新会议" }).click();
  const module002SwitchDialog = page.getByRole("dialog", {
    name: "更换模板或开始新会议",
  });
  await module002SwitchDialog.getByRole("button", { name: "舍弃草稿" }).click();
  await expect(page.getByRole("dialog", { name: "选择党支部模板" })).toBeVisible();

  expect(module002UnexpectedRequests).toEqual([]);
  expect(module002ConsoleErrors).toEqual([]);
});

test("002 在真实 Chrome 中本地解析文本层 PDF 并执行中文图片 OCR", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  test.skip(testInfo.project.name !== "chrome-desktop", "OCR 资源只需在 Chrome 项目执行一次重型回归");
  const module002ExternalRequests = [];
  page.on("request", (module002Request) => {
    const module002Url = new URL(module002Request.url());
    if (!["localhost", "127.0.0.1"].includes(module002Url.hostname)) {
      module002ExternalRequests.push(module002Url.origin + module002Url.pathname);
    }
  });

  await module002InstallTestWorkspace(page);
  await module002InstallAiMock(page);
  await module002EnterSharedWorkspace(page);
  await page.getByRole("button", { name: "选择党支部模板" }).click();
  await page.getByRole("dialog", { name: "选择党支部模板" })
    .getByRole("button", { name: "党员大会" })
    .click();
  await page.getByRole("button", { name: "+ 添加第一个议题" }).click();

  const module002MaterialInput = page.getByLabel("第 1 个议题上传材料");
  await module002MaterialInput.setInputFiles(module002TextPdfFixturePath);
  const module002PdfCard = page.locator(".module002SourceCard").filter({
    hasText: "文本层多页合成材料.pdf",
  });
  await expect(module002PdfCard.getByText("已选段", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(module002PdfCard.locator("textarea")).not.toHaveValue("");

  await module002MaterialInput.setInputFiles(module002ImageFixturePath);
  const module002ImageCard = page.locator(".module002SourceCard").filter({
    hasText: "普通合成材料.png",
  });
  await expect(module002ImageCard.locator(".module002SourceStatus")).toHaveText(
    /已选段|需人工选择/,
    { timeout: 90000 },
  );
  await expect(module002ImageCard.locator(".module002SourceStatus")).not.toContainText("失败");
  expect(module002ExternalRequests).toEqual([]);
});

test("002 将材料上传到用户点击的对应议题卡", async ({ page }) => {
  await module002InstallTestWorkspace(page);
  await module002EnterSharedWorkspace(page);
  await page.getByRole("button", { name: "选择党支部模板" }).click();
  await page.getByRole("dialog", { name: "选择党支部模板" })
    .getByRole("button", { name: "党员大会" })
    .click();
  await page.getByRole("button", { name: "+ 添加第一个议题" }).click();
  await page.getByRole("button", { name: "+ 添加后续议题" }).click();
  await page.getByRole("button", { name: "+ 添加后续议题" }).click();
  await page.getByRole("button", { name: "+ 添加后续议题" }).click();

  const module002TopicCards = page.locator(".module002TopicCard");
  await expect(module002TopicCards).toHaveCount(4);
  await page.getByLabel("第 3 个议题上传材料").setInputFiles(module002DocxFixturePath);
  await expect(module002TopicCards.nth(2).getByText("已选段", { exact: true })).toBeVisible();
  await expect(module002TopicCards.nth(0).locator(".module002SourceCard")).toHaveCount(0);
  await expect(module002TopicCards.nth(1).locator(".module002SourceCard")).toHaveCount(0);
  await expect(module002TopicCards.nth(2).locator(".module002SourceCard")).toHaveCount(1);
  await expect(module002TopicCards.nth(3).locator(".module002SourceCard")).toHaveCount(0);
});

test("002 第一议题多份材料合并标题，上传入口贴合对应标题输入框", async ({ page }) => {
  await module002InstallTestWorkspace(page);
  await module002EnterSharedWorkspace(page);
  await page.getByRole("button", { name: "选择党支部模板" }).click();
  await page.getByRole("dialog", { name: "选择党支部模板" })
    .getByRole("button", { name: "党员大会" })
    .click();
  await page.getByRole("button", { name: "+ 添加第一个议题" }).click();

  const module002FirstTopicCard = page.locator(".module002TopicCard").first();
  const module002FirstTopicTitleField = module002FirstTopicCard.locator(
    ".module002TopicTitleField",
  );
  await expect(module002FirstTopicTitleField.getByText("上传材料", { exact: true })).toBeVisible();
  await expect(module002FirstTopicTitleField.getByLabel("第 1 个议题上传材料")).toBeAttached();

  const module002FirstTopicUpload = page.getByLabel("第 1 个议题上传材料");
  await module002FirstTopicUpload.setInputFiles(module002DocxFixturePath);
  await expect(module002FirstTopicCard.getByText("已选段", { exact: true })).toBeVisible();
  const module002DocxBuffer = await readFile(module002DocxFixturePath);
  await module002FirstTopicUpload.setInputFiles({
    name: "第一议题补充材料.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: module002DocxBuffer,
  });
  await expect(module002FirstTopicCard.locator(".module002SourceCard")).toHaveCount(2);
  await expect(page.getByLabel("第 1 个议题标题")).toHaveValue(
    "第一议题合成材料甲、第一议题补充材料",
  );
});
