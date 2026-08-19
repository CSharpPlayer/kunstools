export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const platformDashboardOfficialDeepSeekBaseUrl = "https://api.deepseek.com";
const platformDashboardBalanceRateBuckets = new Map();
const platformDashboardBalanceRateWindowMs = 60_000;
const platformDashboardBalanceRateLimit = 6;

/**
 * 确认当前模型服务地址是 DeepSeek 官方地址，避免向其他兼容服务发起余额请求。
 */
function platformDashboardUsesOfficialDeepSeek() {
  const platformDashboardConfiguredBaseUrl =
    process.env.MODULE002_DEEPSEEK_BASE_URL ??
    platformDashboardOfficialDeepSeekBaseUrl;

  try {
    const platformDashboardParsedUrl = new URL(
      platformDashboardConfiguredBaseUrl,
    );
    return (
      platformDashboardParsedUrl.origin ===
        platformDashboardOfficialDeepSeekBaseUrl &&
      platformDashboardParsedUrl.pathname.replace(/\/+$/, "") === ""
    );
  } catch {
    return false;
  }
}

/**
 * 仅在内存中短暂限制单个来源的余额刷新频率，不保存访问或用量记录。
 */
function platformDashboardCanRefreshBalance(platformDashboardRequest) {
  const platformDashboardIp =
    platformDashboardRequest.headers
      .get("cf-connecting-ip")
      ?.trim() ||
    platformDashboardRequest.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    platformDashboardRequest.headers.get("x-real-ip") ||
    "local";
  const platformDashboardNow = Date.now();

  if (platformDashboardBalanceRateBuckets.size > 1_000) {
    platformDashboardBalanceRateBuckets.forEach(
      (platformDashboardBucket, platformDashboardKey) => {
        if (
          platformDashboardNow - platformDashboardBucket.startedAt >=
          platformDashboardBalanceRateWindowMs
        ) {
          platformDashboardBalanceRateBuckets.delete(platformDashboardKey);
        }
      },
    );
  }

  const platformDashboardBucket =
    platformDashboardBalanceRateBuckets.get(platformDashboardIp);

  if (
    !platformDashboardBucket ||
    platformDashboardNow - platformDashboardBucket.startedAt >=
      platformDashboardBalanceRateWindowMs
  ) {
    platformDashboardBalanceRateBuckets.set(platformDashboardIp, {
      startedAt: platformDashboardNow,
      count: 1,
    });
    return true;
  }

  if (platformDashboardBucket.count >= platformDashboardBalanceRateLimit) {
    return false;
  }

  platformDashboardBucket.count += 1;
  return true;
}

/**
 * 将 DeepSeek 官方余额字段收敛为不含密钥的前端展示数据。
 */
function platformDashboardNormalizeBalance(platformDashboardResult) {
  const platformDashboardBalanceInfos = Array.isArray(
    platformDashboardResult?.balance_infos,
  )
    ? platformDashboardResult.balance_infos
        .filter(
          (platformDashboardBalanceInfo) =>
            typeof platformDashboardBalanceInfo?.currency === "string" &&
            typeof platformDashboardBalanceInfo?.total_balance === "string" &&
            typeof platformDashboardBalanceInfo?.granted_balance === "string" &&
            typeof platformDashboardBalanceInfo?.topped_up_balance === "string",
        )
        .map((platformDashboardBalanceInfo) => ({
          currency: platformDashboardBalanceInfo.currency,
          totalBalance: platformDashboardBalanceInfo.total_balance,
          grantedBalance: platformDashboardBalanceInfo.granted_balance,
          toppedUpBalance: platformDashboardBalanceInfo.topped_up_balance,
        }))
    : [];

  return {
    available: Boolean(platformDashboardResult?.is_available),
    balanceInfos: platformDashboardBalanceInfos,
  };
}

/**
 * 查询 DeepSeek 官方账户余额；只返回当前快照，不写入任何持久化存储。
 */
export async function GET(platformDashboardRequest) {
  if (!platformDashboardCanRefreshBalance(platformDashboardRequest)) {
    return Response.json({ error: "刷新过于频繁，请稍后再试" }, { status: 429 });
  }

  if (!platformDashboardUsesOfficialDeepSeek()) {
    return Response.json(
      { error: "当前服务不支持余额查询" },
      { status: 422 },
    );
  }

  const platformDashboardApiKey = process.env.DEEPSEEK_API_KEY;

  if (!platformDashboardApiKey) {
    return Response.json(
      { error: "服务端尚未配置余额查询" },
      { status: 503 },
    );
  }

  const platformDashboardController = new AbortController();
  const platformDashboardTimeout = setTimeout(
    () => platformDashboardController.abort(),
    12_000,
  );

  try {
    const platformDashboardResponse = await fetch(
      `${platformDashboardOfficialDeepSeekBaseUrl}/user/balance`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${platformDashboardApiKey}`,
        },
        cache: "no-store",
        signal: platformDashboardController.signal,
      },
    );

    if (!platformDashboardResponse.ok) {
      return Response.json({ error: "余额查询失败" }, { status: 502 });
    }

    const platformDashboardBalance = platformDashboardNormalizeBalance(
      await platformDashboardResponse.json(),
    );

    if (!platformDashboardBalance.balanceInfos.length) {
      return Response.json({ error: "余额查询失败" }, { status: 502 });
    }

    return Response.json({
      ...platformDashboardBalance,
      updatedAt: new Date().toISOString(),
    });
  } catch (platformDashboardError) {
    return Response.json(
      {
        error:
          platformDashboardError?.name === "AbortError"
            ? "余额查询超时"
            : "余额查询失败",
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(platformDashboardTimeout);
  }
}
