import { LoaderCircle } from "lucide-react";

/**
 * 只在 001 模块真实等待时显示内容区轻量加载状态。
 */
export default function Module001Loading() {
  return (
    <div className="platformStatusState" role="status" aria-live="polite">
      <LoaderCircle className="platformLoadingIcon" aria-hidden="true" />
      <span>加载中</span>
    </div>
  );
}
