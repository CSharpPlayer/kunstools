"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * 提供带焦点入口和 Esc 关闭的模块内通用对话框。
 */
export default function Module001Dialog({
  module001Title,
  module001Description,
  module001Open,
  module001OnClose,
  module001Children,
  module001Footer,
  module001Danger = false,
}) {
  const module001DialogRef = useRef(null);

  useEffect(() => {
    if (!module001Open) {
      return undefined;
    }

    const module001PreviousFocus = document.activeElement;
    module001DialogRef.current?.focus();

    /** 允许用户使用 Esc 关闭当前对话框。 */
    function module001HandleEscape(module001Event) {
      if (module001Event.key === "Escape") {
        module001OnClose();
      }
    }

    window.addEventListener("keydown", module001HandleEscape);
    return () => {
      window.removeEventListener("keydown", module001HandleEscape);
      module001PreviousFocus?.focus?.();
    };
  }, [module001OnClose, module001Open]);

  if (!module001Open) {
    return null;
  }

  return (
    <div className="module001DialogLayer" role="presentation">
      <button
        aria-label="关闭对话框"
        className="module001DialogBackdrop"
        onClick={module001OnClose}
        type="button"
      />
      <section
        aria-describedby={
          module001Description ? "module001DialogDescription" : undefined
        }
        aria-labelledby="module001DialogTitle"
        aria-modal="true"
        className={`module001Dialog ${
          module001Danger ? "module001DialogDanger" : ""
        }`}
        ref={module001DialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="module001DialogHeader">
          <div>
            <h2 id="module001DialogTitle">{module001Title}</h2>
            {module001Description ? (
              <p id="module001DialogDescription">{module001Description}</p>
            ) : null}
          </div>
          <button
            aria-label="关闭"
            className="module001IconButton"
            onClick={module001OnClose}
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="module001DialogBody">{module001Children}</div>
        {module001Footer ? (
          <footer className="module001DialogFooter">{module001Footer}</footer>
        ) : null}
      </section>
    </div>
  );
}
