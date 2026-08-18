import { defineConfig, devices } from "@playwright/test";

const platformE2eBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const platformE2ePort = new URL(platformE2eBaseUrl).port || "3000";
const platformE2eServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND
  || `npm run dev -- --hostname 127.0.0.1 --port ${platformE2ePort}`;

/**
 * 使用真实 Chrome 与 Edge 验证各业务模块的关键桌面流程。
 */
export default defineConfig({
  testDir: "./app/(platform)/tools",
  testMatch: "**/tests/e2e/*.spec.js",
  fullyParallel: false,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: platformE2eBaseUrl,
    actionTimeout: 20000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: platformE2eServerCommand,
    url: platformE2eBaseUrl,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "chrome-desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "edge-desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
});
