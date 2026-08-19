// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const platformDashboardApiUrl =
  "http://localhost:3000/api/platform-dashboard/deepseek-balance";

/** 创建独立来源的余额查询请求。 */
function platformDashboardCreateRequest(platformDashboardIp = "balance-test-1") {
  return new Request(platformDashboardApiUrl, {
    headers: { "x-real-ip": platformDashboardIp },
  });
}

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.MODULE002_DEEPSEEK_BASE_URL;
  vi.unstubAllGlobals();
});

describe("platform DeepSeek 余额仪表盘接口", () => {
  it("只返回 DeepSeek 官方余额字段，不返回 API Key", async () => {
    process.env.DEEPSEEK_API_KEY = "balance-secret-key";
    const platformDashboardFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          is_available: true,
          balance_infos: [
            {
              currency: "CNY",
              total_balance: "110.00",
              granted_balance: "10.00",
              topped_up_balance: "100.00",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", platformDashboardFetch);

    const platformDashboardResponse = await GET(
      platformDashboardCreateRequest(),
    );
    const platformDashboardBody = await platformDashboardResponse.json();

    expect(platformDashboardResponse.status).toBe(200);
    expect(platformDashboardBody).toMatchObject({
      available: true,
      balanceInfos: [
        {
          currency: "CNY",
          totalBalance: "110.00",
          grantedBalance: "10.00",
          toppedUpBalance: "100.00",
        },
      ],
    });
    expect(platformDashboardBody.updatedAt).toEqual(expect.any(String));
    expect(JSON.stringify(platformDashboardBody)).not.toContain(
      "balance-secret-key",
    );
    expect(platformDashboardFetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/user/balance",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer balance-secret-key",
        }),
      }),
    );
  });

  it("未配置密钥时不会请求 DeepSeek", async () => {
    const platformDashboardFetch = vi.fn();
    vi.stubGlobal("fetch", platformDashboardFetch);

    const platformDashboardResponse = await GET(
      platformDashboardCreateRequest("balance-test-2"),
    );

    expect(platformDashboardResponse.status).toBe(503);
    expect(platformDashboardFetch).not.toHaveBeenCalled();
  });

  it("仅允许 DeepSeek 官方地址启用余额查询", async () => {
    process.env.DEEPSEEK_API_KEY = "balance-secret-key";
    process.env.MODULE002_DEEPSEEK_BASE_URL = "https://compatible.example.com";
    const platformDashboardFetch = vi.fn();
    vi.stubGlobal("fetch", platformDashboardFetch);

    const platformDashboardResponse = await GET(
      platformDashboardCreateRequest("balance-test-3"),
    );

    expect(platformDashboardResponse.status).toBe(422);
    expect(platformDashboardFetch).not.toHaveBeenCalled();
  });

  it("将 DeepSeek 上游异常收敛为通用失败信息", async () => {
    process.env.DEEPSEEK_API_KEY = "balance-secret-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream detail", { status: 401 })),
    );

    const platformDashboardResponse = await GET(
      platformDashboardCreateRequest("balance-test-4"),
    );
    const platformDashboardBody = await platformDashboardResponse.json();

    expect(platformDashboardResponse.status).toBe(502);
    expect(platformDashboardBody).toEqual({ error: "余额查询失败" });
  });
});
