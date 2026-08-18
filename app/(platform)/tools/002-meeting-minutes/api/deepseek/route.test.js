// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const module002ApiUrl = "http://localhost:3000/tools/002-meeting-minutes/api/deepseek";

/** 创建带同源头和独立测试 IP 的服务端请求。 */
function module002CreateRequest(module002Body, module002Ip = "test-1") {
  return new Request(module002ApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-real-ip": module002Ip,
    },
    body: JSON.stringify(module002Body),
  });
}

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.MODULE002_DEEPSEEK_MODELS;
  delete process.env.MODULE002_DEEPSEEK_BASE_URL;
  vi.unstubAllGlobals();
});

describe("module002 DeepSeek server boundary", () => {
  it("GET 只返回白名单与配置状态，不返回密钥", async () => {
    process.env.DEEPSEEK_API_KEY = "secret-test-key";
    const module002Body = await (await GET()).json();
    expect(module002Body.models).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(module002Body.configured).toBe(true);
    expect(JSON.stringify(module002Body)).not.toContain("secret-test-key");
  });

  it("拒绝没有同源 Origin 的请求", async () => {
    const module002Response = await POST(new Request(module002ApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "test-2" },
      body: JSON.stringify({ action: "generate", model: "deepseek-v4-flash", prompt: "合成" }),
    }));
    expect(module002Response.status).toBe(403);
  });

  it("未配置密钥时在联网前明确失败", async () => {
    const module002Fetch = vi.fn();
    vi.stubGlobal("fetch", module002Fetch);
    const module002Response = await POST(module002CreateRequest({
      action: "generate",
      model: "deepseek-v4-flash",
      prompt: "合成",
    }, "test-3"));
    expect(module002Response.status).toBe(503);
    expect(module002Fetch).not.toHaveBeenCalled();
  });

  it("即使没有 Content-Length 也按 UTF-8 字节阻止超过 2MB 的正文", async () => {
    process.env.DEEPSEEK_API_KEY = "secret-test-key";
    const module002Fetch = vi.fn();
    vi.stubGlobal("fetch", module002Fetch);
    const module002Response = await POST(module002CreateRequest({
      action: "generate",
      model: "deepseek-v4-flash",
      prompt: "测".repeat(700_000),
    }, "test-oversized"));
    expect(module002Response.status).toBe(413);
    expect(module002Fetch).not.toHaveBeenCalled();
  });

  it("只向允许的 DeepSeek 地址发送固定消息结构", async () => {
    process.env.DEEPSEEK_API_KEY = "secret-test-key";
    process.env.MODULE002_DEEPSEEK_BASE_URL = "https://api.deepseek.test";
    const module002Fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "{\"hostOpening\":{},\"speeches\":[]}" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", module002Fetch);
    const module002Response = await POST(module002CreateRequest({
      action: "generate",
      model: "deepseek-v4-flash",
      prompt: "合成正文",
    }, "test-4"));
    expect(module002Response.status).toBe(200);
    expect(module002Fetch).toHaveBeenCalledTimes(1);
    const [module002Url, module002Options] = module002Fetch.mock.calls[0];
    expect(module002Url).toBe("https://api.deepseek.test/chat/completions");
    const module002Outbound = JSON.parse(module002Options.body);
    expect(module002Outbound.messages).toEqual([
      {
        role: "system",
        content: "你只处理当前用户提供的会议文本。必须仅返回合法 json，不要添加 Markdown。",
      },
      { role: "user", content: "合成正文" },
    ]);
    expect(module002Outbound).not.toHaveProperty("files");
  });
});
