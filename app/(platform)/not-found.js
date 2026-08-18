import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";

/**
 * 在平台外框内部显示简洁的无效网址状态。
 */
export default function PlatformNotFound() {
  return (
    <div className="platformStatusState">
      <CircleAlert className="platformStatusIcon" aria-hidden="true" />
      <strong>页面不存在</strong>
      <Link className="platformPrimaryButton" href="/" scroll={false}>
        <ArrowLeft size={16} aria-hidden="true" />
        返回主页
      </Link>
    </div>
  );
}
