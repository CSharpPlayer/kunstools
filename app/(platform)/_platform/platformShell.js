"use client";

import {
  ChevronDown,
  House,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  platformFindEntryById,
  platformFindEntryByPath,
  platformHomeEntry,
  platformKnownEntries,
  platformModuleList,
} from "./platformModuleCatalog";

const platformStorageKey = "kunstools.platform.state.v1";
const platformHistoryLimit = 40;

/**
 * 为首屏建立与当前网址一致的最小标签集合。
 */
function platformCreateInitialTabIds(platformPathname) {
  const platformCurrentEntry = platformFindEntryByPath(platformPathname);

  if (platformCurrentEntry && platformCurrentEntry.id !== platformHomeEntry.id) {
    return [platformHomeEntry.id, platformCurrentEntry.id];
  }

  return [platformHomeEntry.id];
}

/**
 * 清理已删除、重复或顺序无效的已保存标签编号。
 */
function platformNormalizeTabIds(platformStoredIds = []) {
  const platformValidIds = new Set(
    platformKnownEntries.map((platformEntry) => platformEntry.id),
  );
  const platformUniqueIds = platformStoredIds.filter(
    (platformId, platformIndex) =>
      platformValidIds.has(platformId) &&
      platformStoredIds.indexOf(platformId) === platformIndex &&
      platformId !== platformHomeEntry.id,
  );

  return [platformHomeEntry.id, ...platformUniqueIds];
}

/**
 * 安全读取浏览器中的平台导航偏好。
 */
function platformReadStoredState() {
  try {
    const platformStoredValue = window.localStorage.getItem(platformStorageKey);
    return platformStoredValue ? JSON.parse(platformStoredValue) : null;
  } catch {
    return null;
  }
}

/**
 * 检查设备是否要求减少动画。
 */
function platformPrefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 提供跨页面保留的侧栏、标签和本机导航状态。
 */
export default function PlatformShell({ children }) {
  const platformPathname = usePathname();
  const platformRouter = useRouter();
  const platformInitialTabIds = platformCreateInitialTabIds(platformPathname);
  const [platformOpenTabIds, setPlatformOpenTabIds] = useState(
    platformInitialTabIds,
  );
  const [platformAccessHistory, setPlatformAccessHistory] = useState(
    platformInitialTabIds,
  );
  const [platformIsSidebarExpanded, setPlatformIsSidebarExpanded] =
    useState(true);
  const [platformIsToolbarExpanded, setPlatformIsToolbarExpanded] =
    useState(true);
  const [platformIsMobileSidebarOpen, setPlatformIsMobileSidebarOpen] =
    useState(false);
  const [platformIsRestored, setPlatformIsRestored] = useState(false);
  const platformHasRunRestoreRef = useRef(false);
  const platformTabRefs = useRef(new Map());
  const platformLastValidPathRef = useRef(
    platformFindEntryByPath(platformPathname)?.path ?? platformHomeEntry.path,
  );

  const platformCurrentEntry = platformFindEntryByPath(platformPathname);
  const platformOpenEntries = useMemo(
    () =>
      platformOpenTabIds
        .map((platformEntryId) => platformFindEntryById(platformEntryId))
        .filter(Boolean),
    [platformOpenTabIds],
  );

  useEffect(() => {
    if (platformHasRunRestoreRef.current) {
      return;
    }

    platformHasRunRestoreRef.current = true;
    const platformStoredState = platformReadStoredState();
    const platformRestoreTimer = window.setTimeout(() => {
      if (platformStoredState) {
        const platformRestoredIds = platformNormalizeTabIds(
          platformStoredState.openTabIds,
        );
        const platformCurrentId = platformFindEntryByPath(platformPathname)?.id;

        if (
          platformCurrentId &&
          !platformRestoredIds.includes(platformCurrentId)
        ) {
          platformRestoredIds.push(platformCurrentId);
        }

        setPlatformOpenTabIds(platformRestoredIds);
        setPlatformAccessHistory(
          Array.isArray(platformStoredState.accessHistory)
            ? platformStoredState.accessHistory.filter((platformEntryId) =>
                platformFindEntryById(platformEntryId),
              )
            : [platformHomeEntry.id],
        );

        if (typeof platformStoredState.isSidebarExpanded === "boolean") {
          setPlatformIsSidebarExpanded(platformStoredState.isSidebarExpanded);
        }

        if (typeof platformStoredState.isToolbarExpanded === "boolean") {
          setPlatformIsToolbarExpanded(platformStoredState.isToolbarExpanded);
        }

        const platformStoredActiveEntry = platformFindEntryByPath(
          platformStoredState.activePath,
        );

        if (
          platformPathname === platformHomeEntry.path &&
          platformStoredActiveEntry &&
          platformStoredActiveEntry.path !== platformHomeEntry.path
        ) {
          platformLastValidPathRef.current = platformStoredActiveEntry.path;
          platformRouter.replace(platformStoredActiveEntry.path, {
            scroll: false,
          });
        }
      }

      setPlatformIsRestored(true);
    }, 0);

    return () => window.clearTimeout(platformRestoreTimer);
  }, [platformPathname, platformRouter]);

  useEffect(() => {
    const platformRouteEntry = platformFindEntryByPath(platformPathname);

    if (!platformRouteEntry) {
      return;
    }

    platformLastValidPathRef.current = platformRouteEntry.path;
    const platformRouteSyncTimer = window.setTimeout(() => {
      setPlatformOpenTabIds((platformPreviousIds) =>
        platformPreviousIds.includes(platformRouteEntry.id)
          ? platformPreviousIds
          : [...platformPreviousIds, platformRouteEntry.id],
      );
      setPlatformAccessHistory((platformPreviousHistory) => [
        ...platformPreviousHistory,
        platformRouteEntry.id,
      ].slice(-platformHistoryLimit));
      setPlatformIsMobileSidebarOpen(false);
    }, 0);

    return () => window.clearTimeout(platformRouteSyncTimer);
  }, [platformPathname]);

  useEffect(() => {
    if (!platformIsRestored) {
      return;
    }

    try {
      window.localStorage.setItem(
        platformStorageKey,
        JSON.stringify({
          version: 1,
          openTabIds: platformOpenTabIds,
          accessHistory: platformAccessHistory,
          activePath: platformCurrentEntry
            ? platformCurrentEntry.path
            : platformLastValidPathRef.current,
          isSidebarExpanded: platformIsSidebarExpanded,
          isToolbarExpanded: platformIsToolbarExpanded,
        }),
      );
    } catch {
      // 浏览器禁用本地存储时保持当前会话可用，不打扰访客。
    }
  }, [
    platformAccessHistory,
    platformCurrentEntry,
    platformIsRestored,
    platformIsSidebarExpanded,
    platformIsToolbarExpanded,
    platformOpenTabIds,
  ]);

  useEffect(() => {
    const platformActiveTab = platformCurrentEntry
      ? platformTabRefs.current.get(platformCurrentEntry.id)
      : null;

    platformActiveTab?.scrollIntoView({
      behavior: platformPrefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [platformCurrentEntry, platformOpenTabIds]);

  useEffect(() => {
    /** 允许 Esc 关闭手机侧栏。 */
    function platformHandleEscape(platformEvent) {
      if (platformEvent.key === "Escape") {
        setPlatformIsMobileSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", platformHandleEscape);
    return () => window.removeEventListener("keydown", platformHandleEscape);
  }, []);

  /**
   * 使用 Next.js 客户端路由切换内容，并关闭手机侧栏。
   */
  function platformNavigate(platformTargetPath) {
    setPlatformIsMobileSidebarOpen(false);

    if (platformTargetPath !== platformPathname) {
      platformRouter.push(platformTargetPath, { scroll: false });
    }
  }

  /**
   * 关闭指定模块标签，并在必要时返回最近访问的有效标签。
   */
  function platformCloseTab(platformEntryId) {
    if (platformEntryId === platformHomeEntry.id) {
      return;
    }

    const platformRemainingIds = platformOpenTabIds.filter(
      (platformId) => platformId !== platformEntryId,
    );
    const platformClosingCurrentTab =
      platformCurrentEntry?.id === platformEntryId;
    let platformTargetEntry = platformHomeEntry;

    if (platformClosingCurrentTab) {
      for (
        let platformHistoryIndex = platformAccessHistory.length - 1;
        platformHistoryIndex >= 0;
        platformHistoryIndex -= 1
      ) {
        const platformHistoryId =
          platformAccessHistory[platformHistoryIndex];

        if (
          platformHistoryId !== platformEntryId &&
          platformRemainingIds.includes(platformHistoryId)
        ) {
          platformTargetEntry =
            platformFindEntryById(platformHistoryId) ?? platformHomeEntry;
          break;
        }
      }
    }

    setPlatformOpenTabIds(platformRemainingIds);
    setPlatformAccessHistory((platformPreviousHistory) =>
      platformPreviousHistory.filter(
        (platformHistoryId) => platformHistoryId !== platformEntryId,
      ),
    );

    if (platformClosingCurrentTab) {
      platformRouter.push(platformTargetEntry.path, { scroll: false });
    }
  }

  /**
   * 将鼠标纵向滚轮转换成标签栏横向滚动。
   */
  function platformHandleTabWheel(platformEvent) {
    const platformTabList = platformEvent.currentTarget;

    if (
      Math.abs(platformEvent.deltaY) > Math.abs(platformEvent.deltaX) &&
      platformTabList.scrollWidth > platformTabList.clientWidth
    ) {
      platformEvent.preventDefault();
      platformTabList.scrollLeft += platformEvent.deltaY;
    }
  }

  const platformSidebarClassName = [
    "platformSidebar",
    platformIsSidebarExpanded ? "" : "platformSidebarCollapsed",
    platformIsMobileSidebarOpen ? "platformSidebarMobileOpen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="platformShell">
      <button
        aria-label="关闭侧栏"
        className={`platformMobileOverlay ${
          platformIsMobileSidebarOpen ? "platformMobileOverlayVisible" : ""
        }`}
        onClick={() => setPlatformIsMobileSidebarOpen(false)}
        tabIndex={platformIsMobileSidebarOpen ? 0 : -1}
        type="button"
      />

      <aside className={platformSidebarClassName} aria-label="平台导航">
        <div className="platformSidebarHeader">
          <button
            aria-label="返回主页"
            className="platformBrand"
            data-platform-tooltip="鲲的工具组"
            onClick={() => platformNavigate(platformHomeEntry.path)}
            type="button"
          >
            <span className="platformBrandMark" aria-hidden="true">
              鲲
            </span>
            <span className="platformBrandText">鲲的工具组</span>
          </button>

          <button
            aria-label={
              platformIsSidebarExpanded ? "收起侧栏" : "展开侧栏"
            }
            className="platformIconButton platformDesktopSidebarToggle"
            data-platform-tooltip={
              platformIsSidebarExpanded ? "收起侧栏" : "展开侧栏"
            }
            onClick={() =>
              setPlatformIsSidebarExpanded(
                (platformPreviousValue) => !platformPreviousValue,
              )
            }
            type="button"
          >
            {platformIsSidebarExpanded ? (
              <PanelLeftClose size={18} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} aria-hidden="true" />
            )}
          </button>

          <button
            aria-label="关闭侧栏"
            className="platformIconButton platformMobileSidebarClose"
            onClick={() => setPlatformIsMobileSidebarOpen(false)}
            type="button"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className="platformSidebarNav" aria-label="功能导航">
          <button
            aria-current={
              platformCurrentEntry?.id === platformHomeEntry.id
                ? "page"
                : undefined
            }
            className={`platformSidebarItem ${
              platformCurrentEntry?.id === platformHomeEntry.id
                ? "platformSidebarItemActive"
                : ""
            }`}
            data-platform-tooltip="主页"
            onClick={() => platformNavigate(platformHomeEntry.path)}
            type="button"
          >
            <House size={19} strokeWidth={1.9} aria-hidden="true" />
            <span className="platformSidebarLabel">主页</span>
          </button>

          <div className="platformToolbarGroup">
            <button
              aria-controls="platformToolbarModules"
              aria-expanded={platformIsToolbarExpanded}
              className="platformSidebarItem"
              data-platform-tooltip="工具栏"
              onClick={() =>
                setPlatformIsToolbarExpanded(
                  (platformPreviousValue) => !platformPreviousValue,
                )
              }
              type="button"
            >
              <Wrench size={19} strokeWidth={1.9} aria-hidden="true" />
              <span className="platformSidebarLabel">工具栏</span>
              <ChevronDown
                className={`platformToolbarChevron ${
                  platformIsToolbarExpanded
                    ? "platformToolbarChevronOpen"
                    : ""
                }`}
                size={16}
                aria-hidden="true"
              />
            </button>

            <div
              className={`platformToolbarModules ${
                platformIsToolbarExpanded
                  ? "platformToolbarModulesOpen"
                  : ""
              }`}
              id="platformToolbarModules"
            >
              {platformModuleList.map((platformModule) => {
                const PlatformModuleIcon = platformModule.icon;
                const platformIsActive =
                  platformCurrentEntry?.id === platformModule.id;

                return (
                  <button
                    aria-current={platformIsActive ? "page" : undefined}
                    className={`platformSidebarItem platformModuleItem ${
                      platformIsActive ? "platformSidebarItemActive" : ""
                    }`}
                    data-platform-tooltip={platformModule.name}
                    key={platformModule.id}
                    onClick={() => platformNavigate(platformModule.path)}
                    title={platformModule.name}
                    type="button"
                  >
                    <PlatformModuleIcon
                      size={19}
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                    <span className="platformSidebarLabel platformModuleLabel">
                      {platformModule.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>

      <div className="platformWorkspace">
        <header className="platformTabsHeader">
          <button
            aria-label="打开侧栏"
            className="platformMobileMenuButton"
            onClick={() => setPlatformIsMobileSidebarOpen(true)}
            type="button"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <nav
            aria-label="打开的页面"
            className="platformTabsScroller"
            onWheel={platformHandleTabWheel}
          >
            {platformOpenEntries.map((platformEntry) => {
              const platformIsActive =
                platformCurrentEntry?.id === platformEntry.id;
              const platformCanClose =
                platformEntry.id !== platformHomeEntry.id;

              return (
                <div
                  className={`platformTab ${
                    platformIsActive ? "platformTabActive" : ""
                  }`}
                  key={platformEntry.id}
                  ref={(platformElement) => {
                    if (platformElement) {
                      platformTabRefs.current.set(
                        platformEntry.id,
                        platformElement,
                      );
                    } else {
                      platformTabRefs.current.delete(platformEntry.id);
                    }
                  }}
                  title={platformEntry.name}
                >
                  <button
                    aria-current={platformIsActive ? "page" : undefined}
                    className="platformTabLabel"
                    onClick={() => platformNavigate(platformEntry.path)}
                    type="button"
                  >
                    {platformEntry.name}
                  </button>

                  {platformCanClose ? (
                    <button
                      aria-label={`关闭 ${platformEntry.name}`}
                      className="platformTabClose"
                      onClick={() => platformCloseTab(platformEntry.id)}
                      type="button"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </header>

        <main className="platformContent">
          <div className="platformContentTransition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
