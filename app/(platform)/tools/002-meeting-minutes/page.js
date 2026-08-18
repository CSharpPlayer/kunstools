import Module002ClientEntry from "./_module002/module002ClientEntry";
import "./_module002/module002.css";

export const metadata = {
  title: "002 党建会议记录辅助生成工具",
};

/** 提供模块 002 固定网址和本地优先会议记录入口。 */
export default function Module002Page() {
  return <Module002ClientEntry />;
}
