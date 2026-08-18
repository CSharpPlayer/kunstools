"use client";

import { HardDrive, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformModuleList } from "./platformModuleCatalog";
import {
  platformChooseWorkspaceDirectory,
  platformEnsureWorkspacePermission,
  platformGetWorkspaceCapability,
  platformReadRememberedWorkspace,
  platformRememberWorkspace,
} from "./workspace/platformWorkspace";

/**
 * 渲染主页工具入口，并在同一处管理唯一的本地工作区根目录。
 */
export default function PlatformHomeContent() {
  const [platformWorkspaceStatus, setPlatformWorkspaceStatus] =
    useState("checking");
  const [platformWorkspaceName, setPlatformWorkspaceName] = useState("");
  const [platformWorkspaceMessage, setPlatformWorkspaceMessage] =
    useState("");

  useEffect(() => {
    let platformCancelled = false;

    /** 无弹窗地读取此前由主页选择的共享根目录。 */
    async function platformRestoreWorkspace() {
      const platformCapability = platformGetWorkspaceCapability();

      if (!platformCapability.supported) {
        if (!platformCancelled) {
          setPlatformWorkspaceStatus("unsupported");
          setPlatformWorkspaceMessage(platformCapability.reason);
        }
        return;
      }

      try {
        const platformRemembered = await platformReadRememberedWorkspace();

        if (platformCancelled) {
          return;
        }

        if (!platformRemembered?.handle) {
          setPlatformWorkspaceStatus("empty");
          return;
        }

        setPlatformWorkspaceName(
          platformRemembered.name ?? platformRemembered.handle.name,
        );
        const platformGranted = await platformEnsureWorkspacePermission(
          platformRemembered.handle,
          false,
        );

        if (!platformCancelled) {
          setPlatformWorkspaceStatus(
            platformGranted ? "ready" : "permissionRequired",
          );
        }
      } catch {
        if (!platformCancelled) {
          setPlatformWorkspaceStatus("empty");
          setPlatformWorkspaceMessage("无法读取此前选择的本地工作区，请重新选择。");
        }
      }
    }

    platformRestoreWorkspace();
    return () => {
      platformCancelled = true;
    };
  }, []);

  /** 由主页的明确点击选择新的共享根目录并立即记住。 */
  async function platformSelectWorkspace() {
    setPlatformWorkspaceMessage("");
    setPlatformWorkspaceStatus("selecting");

    try {
      const platformRootHandle = await platformChooseWorkspaceDirectory();
      const platformGranted = await platformEnsureWorkspacePermission(
        platformRootHandle,
        true,
      );

      if (!platformGranted) {
        throw new Error("未获得所选文件夹的读写权限");
      }

      await platformRememberWorkspace(platformRootHandle);
      setPlatformWorkspaceName(platformRootHandle.name);
      setPlatformWorkspaceStatus("ready");
    } catch (platformError) {
      if (platformError?.name === "AbortError") {
        setPlatformWorkspaceStatus(platformWorkspaceName ? "ready" : "empty");
        return;
      }

      setPlatformWorkspaceStatus("empty");
      setPlatformWorkspaceMessage(
        platformError instanceof Error
          ? platformError.message
          : "选择本地工作区失败，请重试。",
      );
    }
  }

  /** 由主页的明确点击重新请求此前根目录的读写权限。 */
  async function platformRestoreWorkspacePermission() {
    setPlatformWorkspaceMessage("");
    setPlatformWorkspaceStatus("selecting");

    try {
      const platformRemembered = await platformReadRememberedWorkspace();

      if (!platformRemembered?.handle) {
        setPlatformWorkspaceStatus("empty");
        return;
      }

      const platformGranted = await platformEnsureWorkspacePermission(
        platformRemembered.handle,
        true,
      );

      if (!platformGranted) {
        throw new Error("未获得本地工作区读写权限");
      }

      setPlatformWorkspaceName(
        platformRemembered.name ?? platformRemembered.handle.name,
      );
      setPlatformWorkspaceStatus("ready");
    } catch (platformError) {
      setPlatformWorkspaceStatus("permissionRequired");
      setPlatformWorkspaceMessage(
        platformError instanceof Error
          ? platformError.message
          : "重新授权本地工作区失败，请更换文件夹。",
      );
    }
  }

  const platformWorkspaceBusy =
    platformWorkspaceStatus === "checking" ||
    platformWorkspaceStatus === "selecting";
  const platformWorkspaceReady = platformWorkspaceStatus === "ready";
  const platformWorkspacePermissionRequired =
    platformWorkspaceStatus === "permissionRequired";

  return (
    <section className="platformHomeGrid" aria-label="工具入口">
      <article className="platformWorkspaceCard">
        <span className="platformToolIcon" aria-hidden="true">
          {platformWorkspacePermissionRequired ? (
            <RefreshCcw size={30} strokeWidth={1.8} />
          ) : (
            <HardDrive size={30} strokeWidth={1.8} />
          )}
        </span>
        <span className="platformToolName">本地工作区</span>
        <span className="platformWorkspaceName" title={platformWorkspaceName}>
          {platformWorkspaceReady
            ? platformWorkspaceName
            : platformWorkspaceBusy
              ? "正在检查"
              : platformWorkspacePermissionRequired
                ? "需要重新授权"
                : "未选择"}
        </span>
        <button
          className="platformWorkspaceAction"
          disabled={platformWorkspaceBusy || platformWorkspaceStatus === "unsupported"}
          onClick={
            platformWorkspacePermissionRequired
              ? platformRestoreWorkspacePermission
              : platformSelectWorkspace
          }
          type="button"
        >
          {platformWorkspacePermissionRequired
            ? "重新授权"
            : platformWorkspaceReady
              ? "更换文件夹"
              : "选择文件夹"}
        </button>
        {platformWorkspaceMessage ? (
          <span className="platformWorkspaceMessage" role="status">
            {platformWorkspaceMessage}
          </span>
        ) : null}
      </article>
      {platformModuleList.map((platformModule) => {
        const PlatformModuleIcon = platformModule.icon;

        return (
          <Link
            className="platformToolCard"
            href={platformModule.path}
            key={platformModule.id}
            scroll={false}
            title={platformModule.name}
          >
            <span className="platformToolIcon" aria-hidden="true">
              <PlatformModuleIcon size={30} strokeWidth={1.8} />
            </span>
            <span className="platformToolName">{platformModule.name}</span>
          </Link>
        );
      })}
    </section>
  );
}
