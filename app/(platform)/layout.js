import PlatformShell from "./_platform/platformShell";
import "./_platform/platformShell.css";

/**
 * 让主页、工具模块和错误状态共享同一个持久平台外框。
 */
export default function PlatformLayout({ children }) {
  return <PlatformShell>{children}</PlatformShell>;
}
