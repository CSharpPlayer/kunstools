"use client";

import dynamic from "next/dynamic";

const Module002App = dynamic(() => import("./module002App"), {
  ssr: false,
  loading: () => (
    <div className="platformStatusState" role="status">
      <span className="platformLoadingIcon" aria-hidden="true" />
      <span>加载会议记录工具</span>
    </div>
  ),
});

/** 将依赖本地文件系统、编辑器和 Worker 的模块隔离在客户端。 */
export default function Module002ClientEntry() {
  return <Module002App />;
}
