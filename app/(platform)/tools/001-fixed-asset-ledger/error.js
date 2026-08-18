"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

/** 在 001 模块异常时隐藏业务细节并提供安全重试。 */
export default function Module001Error({ unstable_retry: module001Retry }) {
  return (
    <div className="platformStatusState" role="alert">
      <TriangleAlert className="platformStatusIcon" aria-hidden="true" />
      <strong>本地台账模块加载失败</strong>
      <span>本地项目数据没有被上传或删除。</span>
      <button
        className="platformPrimaryButton"
        onClick={module001Retry}
        type="button"
      >
        <RotateCcw size={16} aria-hidden="true" />
        重试
      </button>
    </div>
  );
}
