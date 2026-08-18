"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/**
 * 在模块渲染异常时保留平台外框，并提供一次明确的重试操作。
 */
export default function PlatformError({ error, unstable_retry: platformRetry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="platformStatusState" role="alert">
      <TriangleAlert className="platformStatusIcon" aria-hidden="true" />
      <strong>加载失败</strong>
      <button
        className="platformPrimaryButton"
        type="button"
        onClick={platformRetry}
      >
        <RotateCcw size={16} aria-hidden="true" />
        重试
      </button>
    </div>
  );
}
