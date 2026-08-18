"use client";

import { LoaderCircle, X } from "lucide-react";

/**
 * 展示大型复制、解析、导入和导出操作的阶段、进度与取消入口。
 */
export default function Module001OperationOverlay({
  module001Operation,
  module001OnCancel,
}) {
  if (!module001Operation) {
    return null;
  }

  const module001Progress = Math.max(
    0,
    Math.min(100, Math.round((module001Operation.ratio ?? 0) * 100)),
  );

  return (
    <div className="module001OperationLayer" role="status" aria-live="polite">
      <div className="module001OperationCard">
        <LoaderCircle
          className="module001Spin"
          size={24}
          aria-hidden="true"
        />
        <strong>{module001Operation.title}</strong>
        <span>{module001Operation.detail}</span>
        <div
          aria-label={`进度 ${module001Progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={module001Progress}
          className="module001ProgressTrack"
          role="progressbar"
        >
          <span style={{ width: `${module001Progress}%` }} />
        </div>
        <small>{module001Progress}%</small>
        {module001Operation.cancelable ? (
          <button
            className="module001SecondaryButton"
            onClick={module001OnCancel}
            type="button"
          >
            <X size={15} aria-hidden="true" />
            取消
          </button>
        ) : null}
      </div>
    </div>
  );
}
