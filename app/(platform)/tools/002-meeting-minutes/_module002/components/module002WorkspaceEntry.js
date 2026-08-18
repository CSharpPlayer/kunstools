"use client";

import { HardDrive, ShieldCheck } from "lucide-react";
import Link from "next/link";

/** 首次进入或权限丢失时只显示简洁工作文件夹入口。 */
export default function Module002WorkspaceEntry({
  module002Status,
  module002Message,
}) {
  const module002Busy =
    module002Status === "loading" || module002Status === "opening";
  const module002Unsupported = module002Status === "unsupported";

  return (
    <section className="module002WorkspaceEntry">
      <div className="module002WorkspaceCard">
        <span className="module002WorkspaceIcon">
          {module002Unsupported ? <HardDrive size={28} /> : <ShieldCheck size={28} />}
        </span>
        <h1>本地工作区</h1>
        <p>
          {module002Unsupported
            ? "当前浏览器无法使用本地工作区。"
            : "请先在主页选择或重新授权本地工作区。"}
        </p>
        {module002Message ? <div className="module002WorkspaceMessage" role="status">{module002Message}</div> : null}
        {!module002Unsupported && !module002Busy ? (
          <Link className="module002PrimaryButton" href="/" scroll={false}>
            返回主页设置本地工作区
          </Link>
        ) : null}
        <small>请使用 Windows 桌面版 Chrome 或 Edge</small>
      </div>
    </section>
  );
}
