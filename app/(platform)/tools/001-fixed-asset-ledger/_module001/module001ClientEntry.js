"use client";

import dynamic from "next/dynamic";

const Module001App = dynamic(() => import("./module001App"), {
  ssr: false,
  loading: () => (
    <div className="platformStatusState" role="status">
      <span className="platformLoadingIcon" aria-hidden="true" />
      <span>加载本地台账模块</span>
    </div>
  ),
});

/** 把依赖浏览器文件系统和 WebGL 的模块隔离在客户端边界内。 */
export default function Module001ClientEntry() {
  return <Module001App />;
}
