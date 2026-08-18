import { afterEach, describe, expect, it, vi } from "vitest";
import { module002RequestAi } from "./module002AiClient";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("module002 AI client retry", () => {
  it("瞬时 503 只重试一次并保留同一请求内容", async () => {
    vi.useFakeTimers();
    const module002Fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "暂时不可用" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: "{}" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", module002Fetch);
    const module002Promise = module002RequestAi({
      action: "generate",
      model: "deepseek-v4-flash",
      prompt: "合成请求",
    });
    await vi.advanceTimersByTimeAsync(600);
    await expect(module002Promise).resolves.toEqual({ content: "{}" });
    expect(module002Fetch).toHaveBeenCalledTimes(2);
    expect(module002Fetch.mock.calls[0][1].body).toBe(
      module002Fetch.mock.calls[1][1].body,
    );
  });

  it("不可重试的 400 不会重复调用", async () => {
    const module002Fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "请求错误" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", module002Fetch);
    await expect(
      module002RequestAi({
        action: "generate",
        model: "deepseek-v4-flash",
        prompt: "合成请求",
      }),
    ).rejects.toThrow("请求错误");
    expect(module002Fetch).toHaveBeenCalledTimes(1);
  });
});
