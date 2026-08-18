import { existsSync, statSync } from "node:fs";
import { expect, test } from "@playwright/test";

const module001DefaultFixturePath =
  "C:/Users/a/OneDrive/Desktop/3 cubes.glb";
const module001FixturePath =
  process.env.MODULE001_REAL_GLB_FIXTURE ?? module001DefaultFixturePath;

/**
 * 为自动化提供浏览器原生 OPFS 目录句柄；产品代码仍只使用用户选择的本地目录。
 * 这样可以覆盖完整写盘和三维加载流程，同时避免自动化操作系统目录选择弹窗。
 */
async function module001InstallTestWorkspace(page) {
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

      window.__module001TestWorkspaceHandle = module001Root;
      return module001Root;
    };

    window.showSaveFilePicker = async () => {
      const module001Root =
        window.__module001TestWorkspaceHandle ??
        (await navigator.storage.getDirectory());
      window.__module001TestWorkspaceHandle = module001Root;
      return module001Root.getFileHandle("module001-roundtrip.zip", {
        create: true,
      });
    };
  });
}

test("真实脱敏 GLB 可完成本地新建、三维加载和初始化", async ({ page }, testInfo) => {
  test.skip(
    !existsSync(module001FixturePath),
    `未找到真实 GLB：${module001FixturePath}`,
  );

  const module001UnexpectedRequests = [];
  page.on("request", (module001Request) => {
    const module001Url = new URL(module001Request.url());
    const module001IsLocalRead =
      ["blob:", "data:"].includes(module001Url.protocol) ||
      (["localhost", "127.0.0.1"].includes(module001Url.hostname) &&
        ["GET", "HEAD"].includes(module001Request.method()));
    if (
      !module001IsLocalRead
    ) {
      module001UnexpectedRequests.push({
        method: module001Request.method(),
        url: module001Url.origin + module001Url.pathname,
      });
    }
  });

  await module001InstallTestWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: "选择文件夹" }).click();
  await expect(page.getByRole("button", { name: "更换文件夹" })).toBeVisible();
  await page.goto("/tools/001-fixed-asset-ledger");
  await expect(page.getByRole("heading", { name: "项目中心" })).toBeVisible();

  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill("真实 GLB 验证");
  await page.getByLabel("库区 GLB").setInputFiles(module001FixturePath);

  const module001HeapBefore = await page.evaluate(
    () => performance.memory?.usedJSHeapSize ?? null,
  );
  const module001StartedAt = Date.now();
  await page.getByRole("button", { name: "创建并导入" }).click();
  await expect(page.getByText("首次初始化", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator("canvas").first()).toBeVisible();
  const module001LoadMs = Date.now() - module001StartedAt;

  const module001CodeInputs = page.locator('input[aria-label="资产编号"]');
  const module001CandidateCount = await module001CodeInputs.count();
  expect(module001CandidateCount).toBeGreaterThan(0);
  await page.getByLabel("全选").check();

  for (let module001Index = 0; module001Index < module001CandidateCount; module001Index += 1) {
    await module001CodeInputs
      .nth(module001Index)
      .fill(String(module001Index + 1).padStart(3, "0"));
  }

  await page.getByRole("button", { name: "完成初始化" }).click();
  await expect(page.getByText("三维台账", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator("canvas").first()).toBeVisible();

  const module001Labels = page.locator(".module001SceneLabel");
  await expect(module001Labels).toHaveCount(module001CandidateCount);
  const module001LabelTexts = await module001Labels.allTextContents();
  await page.waitForTimeout(700);
  await expect(module001Labels).toHaveCount(module001CandidateCount);
  expect(await module001Labels.allTextContents()).toEqual(module001LabelTexts);
  await page
    .getByRole("button", { name: "隐藏资产标签" })
    .click();
  await expect(module001Labels).toHaveCount(0);
  await page
    .getByRole("button", { name: "显示资产标签" })
    .click();
  await expect(module001Labels).toHaveCount(module001CandidateCount);

  await page
    .getByRole("button", { name: "资产高亮颜色" })
    .first()
    .click();
  const module001ColorPanel = page.getByRole("dialog", { name: "颜色面板" });
  await expect(module001ColorPanel).toBeVisible();
  await page
    .getByRole("button", { name: "选择颜色 #DC2626" })
    .click();
  await expect(module001ColorPanel).toBeVisible();
  await page
    .getByRole("button", { name: "选择颜色 #16A34A" })
    .click();
  await expect(module001ColorPanel).toBeVisible();
  await expect(
    page.getByRole("button", { name: "选择颜色 #16A34A" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "关闭颜色面板" }).click();
  await expect(module001ColorPanel).toBeHidden();

  const module001FrameSample = await page.evaluate(
    () =>
      new Promise((module001Resolve) => {
        let module001Frames = 0;
        const module001Start = performance.now();

        /** 统计一秒内的浏览器动画帧，作为当前测试机的小模型交互基线。 */
        function module001CountFrame(module001Now) {
          module001Frames += 1;
          if (module001Now - module001Start >= 1000) {
            module001Resolve({
              frames: module001Frames,
              elapsedMs: module001Now - module001Start,
            });
            return;
          }
          requestAnimationFrame(module001CountFrame);
        }

        requestAnimationFrame(module001CountFrame);
      }),
  );
  const module001HeapAfter = await page.evaluate(
    () => performance.memory?.usedJSHeapSize ?? null,
  );
  const module001Benchmark = {
    browser: testInfo.project.name,
    fixtureBytes: statSync(module001FixturePath).size,
    candidateCount: module001CandidateCount,
    createToSceneMs: module001LoadMs,
    headlessAnimationFrameCallbacks: module001FrameSample.frames,
    headlessAnimationFrameCallbacksPerSecond: Number(
      (
        (module001FrameSample.frames * 1000) /
        module001FrameSample.elapsedMs
      ).toFixed(1),
    ),
    heapBeforeBytes: module001HeapBefore,
    heapAfterBytes: module001HeapAfter,
  };

  await testInfo.attach("module001-real-glb-workspace.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await testInfo.attach("module001-real-glb-benchmark.json", {
    body: Buffer.from(JSON.stringify(module001Benchmark, null, 2)),
    contentType: "application/json",
  });
  console.log(`MODULE001_REAL_GLB ${JSON.stringify(module001Benchmark)}`);

  expect(module001UnexpectedRequests).toEqual([]);

  await page.getByRole("button", { name: "项目 ZIP" }).click();
  await expect(page.locator(".module001OperationLayer")).toBeHidden({
    timeout: 30000,
  });
  const module001ZipBytes = await page.evaluate(async () => {
    const module001ZipHandle =
      await window.__module001TestWorkspaceHandle.getFileHandle(
        "module001-roundtrip.zip",
      );
    return Array.from(
      new Uint8Array(await (await module001ZipHandle.getFile()).arrayBuffer()),
    );
  });
  expect(module001ZipBytes.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "返回项目中心" }).click();
  await expect(page.getByRole("heading", { name: "项目中心" })).toBeVisible();
  await page.getByRole("button", { name: "回收 真实 GLB 验证" }).click();
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await page.getByRole("tab", { name: "回收站" }).click();
  await page
    .getByRole("button", { name: "永久删除 真实 GLB 验证" })
    .click();
  await page.getByLabel(/输入项目名称/).fill("真实 GLB 验证");
  await page.getByRole("button", { name: "永久删除", exact: true }).click();
  await expect(page.getByText("回收站为空", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "项目" }).click();
  await expect(page.getByText("还没有项目", { exact: true })).toBeVisible();

  await page.locator('input[accept=".zip,application/zip"]').setInputFiles({
    name: "module001-roundtrip.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(module001ZipBytes),
  });
  await expect(page.getByText("三维台账", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page
      .getByRole("region", { name: "资产台账" })
      .getByRole("rowgroup")
      .getByRole("row"),
  ).toHaveCount(module001CandidateCount);
});
