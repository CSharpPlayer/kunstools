import Module001ClientEntry from "./_module001/module001ClientEntry";
import "./_module001/module001.css";

export const metadata = {
  title: "001 可视化固定资产管理台账",
};

/**
 * 提供 001 模块固定网址和客户端本地台账入口。
 */
export default function Module001Page() {
  return <Module001ClientEntry />;
}
