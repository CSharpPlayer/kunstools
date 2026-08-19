"use client";

import { CircleAlert, CircleCheck, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const platformDashboardBalanceEndpoint =
  "/api/platform-dashboard/deepseek-balance";

/** 将服务端时间格式化为主页中简洁的本地更新时间。 */
function platformDashboardFormatUpdatedAt(platformDashboardUpdatedAt) {
  if (!platformDashboardUpdatedAt) return "";

  const platformDashboardDate = new Date(platformDashboardUpdatedAt);

  if (Number.isNaN(platformDashboardDate.getTime())) return "";

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(platformDashboardDate);
}

/** 渲染平台主页内的 DeepSeek 实时余额快照，不存储任何余额或用量数据。 */
export default function PlatformDeepSeekBalanceDashboard() {
  const [platformDashboardStatus, setPlatformDashboardStatus] =
    useState("loading");
  const [platformDashboardBalance, setPlatformDashboardBalance] =
    useState(null);
  const [platformDashboardMessage, setPlatformDashboardMessage] = useState("");
  const platformDashboardHasLoadedRef = useRef(false);

  /** 向服务端请求一次 DeepSeek 官方实时余额，不把数据写入浏览器存储。 */
  async function platformDashboardRefreshBalance() {
    setPlatformDashboardStatus("loading");
    setPlatformDashboardMessage("");

    try {
      const platformDashboardResponse = await fetch(
        platformDashboardBalanceEndpoint,
        { cache: "no-store" },
      );

      if (!platformDashboardResponse.ok) {
        setPlatformDashboardBalance(null);
        setPlatformDashboardMessage(
          platformDashboardResponse.status === 429
            ? "请稍后再试"
            : "余额查询失败",
        );
        setPlatformDashboardStatus("error");
        return;
      }

      const platformDashboardResult = await platformDashboardResponse.json();

      if (!Array.isArray(platformDashboardResult.balanceInfos)) {
        throw new Error("余额响应无效");
      }

      setPlatformDashboardBalance(platformDashboardResult);
      setPlatformDashboardStatus("ready");
    } catch {
      setPlatformDashboardBalance(null);
      setPlatformDashboardMessage("余额查询失败");
      setPlatformDashboardStatus("error");
    }
  }

  useEffect(() => {
    if (platformDashboardHasLoadedRef.current) return;

    platformDashboardHasLoadedRef.current = true;
    platformDashboardRefreshBalance();
  }, []);

  const platformDashboardIsLoading = platformDashboardStatus === "loading";
  const platformDashboardUpdatedTime = platformDashboardFormatUpdatedAt(
    platformDashboardBalance?.updatedAt,
  );

  return (
    <section aria-label="可视化仪表盘" className="platformDashboard">
      <div className="platformDashboardHeader">
        <div>
          <h1 className="platformDashboardTitle">可视化仪表盘</h1>
          <div
            aria-live="polite"
            className={`platformDashboardAvailability ${
              platformDashboardStatus === "ready" &&
              platformDashboardBalance?.available
                ? "platformDashboardAvailabilityReady"
                : "platformDashboardAvailabilityUnavailable"
            }`}
          >
            {platformDashboardStatus === "ready" &&
            platformDashboardBalance?.available ? (
              <CircleCheck size={16} aria-hidden="true" />
            ) : (
              <CircleAlert size={16} aria-hidden="true" />
            )}
            <span>
              {platformDashboardIsLoading
                ? "正在查询余额"
                : platformDashboardStatus === "error"
                  ? platformDashboardMessage
                  : platformDashboardBalance?.available
                    ? "API 可用"
                    : "API 余额不足"}
            </span>
          </div>
        </div>

        <button
          aria-label="刷新余额"
          className="platformDashboardRefresh"
          disabled={platformDashboardIsLoading}
          onClick={platformDashboardRefreshBalance}
          type="button"
        >
          <RefreshCcw
            className={platformDashboardIsLoading ? "platformDashboardRefreshing" : ""}
            size={16}
            aria-hidden="true"
          />
          <span>刷新余额</span>
        </button>
      </div>

      {platformDashboardStatus === "ready" ? (
        <div className="platformDashboardBalanceGroups">
          {platformDashboardBalance.balanceInfos.map(
            (platformDashboardBalanceInfo) => (
              <div
                className="platformDashboardBalanceGroup"
                key={platformDashboardBalanceInfo.currency}
              >
                <span className="platformDashboardCurrency">
                  {platformDashboardBalanceInfo.currency}
                </span>
                <div className="platformDashboardCards">
                  <article className="platformDashboardCard">
                    <span>总可用余额</span>
                    <strong>{platformDashboardBalanceInfo.totalBalance}</strong>
                  </article>
                  <article className="platformDashboardCard">
                    <span>赠金余额</span>
                    <strong>{platformDashboardBalanceInfo.grantedBalance}</strong>
                  </article>
                  <article className="platformDashboardCard">
                    <span>充值余额</span>
                    <strong>{platformDashboardBalanceInfo.toppedUpBalance}</strong>
                  </article>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div
          className="platformDashboardCards platformDashboardCardsPlaceholder"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>
      )}

      {platformDashboardUpdatedTime ? (
        <p className="platformDashboardUpdatedAt">
          更新于 {platformDashboardUpdatedTime}
        </p>
      ) : null}
    </section>
  );
}
