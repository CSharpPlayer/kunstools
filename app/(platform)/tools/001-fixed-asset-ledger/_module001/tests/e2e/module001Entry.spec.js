import { expect, test } from "@playwright/test";

/** 为主页选择器提供 OPFS 根目录，避免自动化操作系统目录弹窗。 */
async function module001InstallSharedWorkspacePicker(page) {
  await page.addInitScript(() => {
    let module001Prepared = false;

    window.showDirectoryPicker = async () => {
      const module001Root = await navigator.storage.getDirectory();

      if (!module001Prepared) {
        for await (const [module001Name] of module001Root.entries()) {
          await module001Root.removeEntry(module001Name, { recursive: true });
        }
        module001Prepared = true;
      }

      if (typeof module001Root.queryPermission !== "function") {
        Object.defineProperty(module001Root, "queryPermission", {
          configurable: true,
          value: async () => "granted",
        });
      }
      if (typeof module001Root.requestPermission !== "function") {
        Object.defineProperty(module001Root, "requestPermission", {
          configurable: true,
          value: async () => "granted",
        });
      }

      return module001Root;
    };
  });
}

test("001 从主页共享工作区进入，并且只创建自己的模块文件夹", async ({ page }) => {
  const module001ConsoleErrors = [];
  page.on("console", (module001Message) => {
    if (module001Message.type() === "error") {
      module001ConsoleErrors.push(module001Message.text());
    }
  });

  await module001InstallSharedWorkspacePicker(page);
  await page.goto("/");
  await expect(page.getByText("本地工作区", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "选择文件夹" }).click();
  await expect(page.getByText("未选择", { exact: true })).toHaveCount(0);

  await expect(
    page.getByRole("link", {
      name: "001 可视化固定资产管理台账",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "001 可视化固定资产管理台账",
      exact: true,
    })
    .click();
  await expect(page).toHaveTitle(/001 可视化固定资产管理台账/);
  await expect(page.getByRole("heading", { name: "项目中心" })).toBeVisible();

  const module001Entries = await page.evaluate(async () => {
    const module001Root = await navigator.storage.getDirectory();
    const module001Names = [];
    for await (const [module001Name] of module001Root.entries()) {
      module001Names.push(module001Name);
    }
    return module001Names;
  });
  expect(module001Entries).toContain("001 可视化固定资产管理台账");
  expect(module001Entries).not.toContain("002 党建会议记录辅助生成工具");
  expect(module001ConsoleErrors).toEqual([]);
});

test("未设置共享工作区时，001 只引导返回主页", async ({ page }) => {
  await page.goto("/tools/001-fixed-asset-ledger");
  await expect(
    page.getByRole("link", { name: "返回主页设置本地工作区" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "选择本地工作区" }),
  ).toHaveCount(0);
});

test("平台侧拉栏可平滑收起并恢复到确认宽度", async ({ page }) => {
  await page.goto("/tools/001-fixed-asset-ledger");
  const module001Sidebar = page.locator(".platformSidebar");
  await expect(
    page.getByRole("link", { name: "返回主页设置本地工作区" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "收起侧栏" }).click();
  await expect(module001Sidebar).toHaveCSS("flex-basis", "64px");
  await page.getByRole("button", { name: "展开侧栏" }).click();
  await expect(module001Sidebar).toHaveCSS("flex-basis", "232px");
});
