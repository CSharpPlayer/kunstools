import { defineConfig } from "vitest/config";

/**
 * 让各业务模块的纯业务逻辑和浏览器适配层在本地完成快速回归验证。
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: ["app/**/*.test.js"],
    restoreMocks: true,
  },
});
