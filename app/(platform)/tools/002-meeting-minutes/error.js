"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/** 隔离模块 002 渲染异常，并保留平台标签和导航。 */
export default function Module002Error({ error, unstable_retry: module002Retry }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="platformStatusState" role="alert"><TriangleAlert className="platformStatusIcon" aria-hidden="true" /><strong>会议记录工具加载失败</strong><button className="platformPrimaryButton" onClick={module002Retry} type="button"><RotateCcw size={16} />重试</button></div>;
}
