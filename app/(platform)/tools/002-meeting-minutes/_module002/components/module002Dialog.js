"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/** 提供模块 002 内带焦点恢复和 Esc 关闭的对话框。 */
export default function Module002Dialog({
  module002Open,
  module002Title,
  module002Description,
  module002OnClose,
  children: module002Children,
  module002Footer,
  module002Wide = false,
}) {
  const module002TitleId = useId();
  const module002DescriptionId = useId();
  const module002DialogRef = useRef(null);
  const module002OnCloseRef = useRef(module002OnClose);

  /** 始终调用最新关闭命令，但不让回调引用变化重新执行弹窗焦点初始化。 */
  useEffect(() => {
    module002OnCloseRef.current = module002OnClose;
  }, [module002OnClose]);

  useEffect(() => {
    if (!module002Open) return undefined;
    const module002PreviousFocus = document.activeElement;
    module002DialogRef.current?.focus();
    /** 允许用户按 Esc 关闭当前非破坏性弹窗。 */
    function module002HandleKeyDown(module002Event) {
      if (module002Event.key === "Escape") module002OnCloseRef.current();
    }
    window.addEventListener("keydown", module002HandleKeyDown);
    return () => {
      window.removeEventListener("keydown", module002HandleKeyDown);
      module002PreviousFocus?.focus?.();
    };
  }, [module002Open]);

  if (!module002Open) return null;
  return (
    <div className="module002DialogLayer">
      <button
        aria-label="关闭对话框"
        className="module002DialogBackdrop"
        onClick={module002OnClose}
        type="button"
      />
      <section
        aria-describedby={module002Description ? module002DescriptionId : undefined}
        aria-labelledby={module002TitleId}
        aria-modal="true"
        className={`module002Dialog ${module002Wide ? "module002DialogWide" : ""}`}
        ref={module002DialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="module002DialogHeader">
          <div>
            <h2 id={module002TitleId}>{module002Title}</h2>
            {module002Description ? <p id={module002DescriptionId}>{module002Description}</p> : null}
          </div>
          <button aria-label="关闭" className="module002IconButton" onClick={module002OnClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="module002DialogBody">{module002Children}</div>
        {module002Footer ? <footer className="module002DialogFooter">{module002Footer}</footer> : null}
      </section>
    </div>
  );
}
