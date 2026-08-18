"use client";

import { Check, Pipette, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

const module001PaletteColors = [
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#CA8A04",
  "#65A30D",
  "#16A34A",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#9333EA",
  "#C026D3",
  "#DB2777",
  "#E11D48",
  "#475569",
  "#1E293B",
  "#000000",
  "#FFFFFF",
  "#94A3B8",
  "#CBD5E1",
  "#F1F5F9",
];
const module001ColorPickerListeners = new Set();
let module001ColorPickerSession = {
  pickerId: null,
  left: 8,
  top: 8,
};

/** 订阅当前打开的颜色面板，使单元格重建后仍能恢复打开状态。 */
function module001SubscribeColorPicker(module001Listener) {
  module001ColorPickerListeners.add(module001Listener);
  return () => module001ColorPickerListeners.delete(module001Listener);
}

/** 返回颜色面板会话的稳定快照。 */
function module001GetColorPickerSession() {
  return module001ColorPickerSession;
}

/** 更新当前面板编号和固定定位，并通知仍在页面中的颜色入口。 */
function module001SetColorPickerSession(module001NextSession) {
  module001ColorPickerSession = module001NextSession;
  module001ColorPickerListeners.forEach((module001Listener) =>
    module001Listener(),
  );
}

/** 把输入颜色统一为六位大写十六进制。 */
function module001NormalizeColor(module001Value) {
  const module001Text = String(module001Value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(module001Text)
    ? module001Text.toUpperCase()
    : "#2563EB";
}

/** 将十六进制颜色拆分成 RGB 通道。 */
function module001HexToRgb(module001Value) {
  const module001Color = module001NormalizeColor(module001Value);
  return {
    red: Number.parseInt(module001Color.slice(1, 3), 16),
    green: Number.parseInt(module001Color.slice(3, 5), 16),
    blue: Number.parseInt(module001Color.slice(5, 7), 16),
  };
}

/** 将 RGB 通道重新组合为六位十六进制颜色。 */
function module001RgbToHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((module001Channel) =>
      Math.max(0, Math.min(255, Number(module001Channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

/**
 * 渲染可连续选色的模块内颜色面板；仅点击外部、Esc 或关闭按钮时收起。
 */
export default function Module001ColorPicker({
  module001AriaLabel = "选择颜色",
  module001Disabled = false,
  module001OnChange,
  module001PickerId = null,
  module001ShowValue = false,
  module001Value,
}) {
  const module001NormalizedValue =
    module001NormalizeColor(module001Value);
  const module001Rgb = module001HexToRgb(module001NormalizedValue);
  const module001GeneratedId = useId();
  const module001StablePickerId =
    module001PickerId ?? module001GeneratedId;
  const module001PanelId = `${module001StablePickerId}-panel`;
  const module001ButtonRef = useRef(null);
  const module001PanelRef = useRef(null);
  const module001Session = useSyncExternalStore(
    module001SubscribeColorPicker,
    module001GetColorPickerSession,
    module001GetColorPickerSession,
  );
  const module001Open =
    module001Session.pickerId === module001StablePickerId;

  /** 按按钮位置把面板约束在当前视口内部。 */
  const module001GetPanelPosition = useCallback(() => {
    const module001Button = module001ButtonRef.current;
    if (!module001Button) {
      return { left: module001Session.left, top: module001Session.top };
    }

    const module001Rect = module001Button.getBoundingClientRect();
    const module001PanelWidth = 286;
    const module001PanelHeight = 368;
    const module001Left = Math.max(
      8,
      Math.min(
        window.innerWidth - module001PanelWidth - 8,
        module001Rect.left,
      ),
    );
    const module001Top =
      module001Rect.bottom + 7 + module001PanelHeight <= window.innerHeight
        ? module001Rect.bottom + 7
        : Math.max(8, module001Rect.top - module001PanelHeight - 7);

    return { left: module001Left, top: module001Top };
  }, [module001Session.left, module001Session.top]);

  /** 视口变化时保持当前面板贴近其触发按钮。 */
  const module001PlacePanel = useCallback(() => {
    if (!module001Open) return;
    const module001NextPosition = module001GetPanelPosition();
    module001SetColorPickerSession({
      pickerId: module001StablePickerId,
      ...module001NextPosition,
    });
  }, [
    module001GetPanelPosition,
    module001Open,
    module001StablePickerId,
  ]);

  /** 打开或关闭常驻颜色面板。 */
  function module001TogglePanel() {
    if (module001Disabled) return;
    if (module001Open) {
      module001SetColorPickerSession({ pickerId: null, left: 8, top: 8 });
      return;
    }

    module001SetColorPickerSession({
      pickerId: module001StablePickerId,
      ...module001GetPanelPosition(),
    });
  }

  /** 更新一个 RGB 通道，同时保持面板打开。 */
  function module001UpdateRgb(module001Channel, module001NextValue) {
    module001OnChange(
      module001RgbToHex({
        ...module001Rgb,
        [module001Channel]: module001NextValue,
      }),
    );
  }

  useEffect(() => {
    if (!module001Open) return undefined;

    /** 点击颜色面板和触发按钮以外的位置时关闭面板。 */
    function module001HandleOutsidePointer(module001Event) {
      if (
        !module001PanelRef.current?.contains(module001Event.target) &&
        !module001ButtonRef.current?.contains(module001Event.target)
      ) {
        module001SetColorPickerSession({ pickerId: null, left: 8, top: 8 });
      }
    }

    /** Esc 关闭面板，视口变化时重新定位。 */
    function module001HandleKeyDown(module001Event) {
      if (module001Event.key === "Escape") {
        module001SetColorPickerSession({ pickerId: null, left: 8, top: 8 });
        module001ButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", module001HandleOutsidePointer);
    document.addEventListener("keydown", module001HandleKeyDown);
    window.addEventListener("resize", module001PlacePanel);
    window.addEventListener("scroll", module001PlacePanel, true);
    return () => {
      document.removeEventListener(
        "pointerdown",
        module001HandleOutsidePointer,
      );
      document.removeEventListener("keydown", module001HandleKeyDown);
      window.removeEventListener("resize", module001PlacePanel);
      window.removeEventListener("scroll", module001PlacePanel, true);
    };
  }, [module001Open, module001PlacePanel]);

  const module001Panel = module001Open ? (
    <div
      aria-label="颜色面板"
      className="module001ColorPickerPanel"
      id={module001PanelId}
      ref={module001PanelRef}
      role="dialog"
      style={{ left: module001Session.left, top: module001Session.top }}
    >
      <header>
        <div>
          <Pipette size={15} aria-hidden="true" />
          <strong>高亮颜色</strong>
        </div>
        <button
          aria-label="关闭颜色面板"
          className="module001ColorPickerClose"
          onClick={() =>
            module001SetColorPickerSession({
              pickerId: null,
              left: 8,
              top: 8,
            })
          }
          type="button"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <div className="module001ColorPickerCurrent">
        <span style={{ backgroundColor: module001NormalizedValue }} />
        <code>{module001NormalizedValue}</code>
      </div>

      <div className="module001ColorPalette" aria-label="常用颜色">
        {module001PaletteColors.map((module001Color) => (
          <button
            aria-label={`选择颜色 ${module001Color}`}
            aria-pressed={module001Color === module001NormalizedValue}
            key={module001Color}
            onClick={() => module001OnChange(module001Color)}
            style={{ backgroundColor: module001Color }}
            type="button"
          >
            {module001Color === module001NormalizedValue ? (
              <Check
                color={module001Color === "#FFFFFF" ? "#0f172a" : "#fff"}
                size={14}
                strokeWidth={3}
                aria-hidden="true"
              />
            ) : null}
          </button>
        ))}
      </div>

      <div className="module001ColorChannels">
        {[
          ["red", "红", module001Rgb.red],
          ["green", "绿", module001Rgb.green],
          ["blue", "蓝", module001Rgb.blue],
        ].map(([module001Channel, module001Label, module001ChannelValue]) => (
          <label key={module001Channel}>
            <span>{module001Label}</span>
            <input
              aria-label={`${module001Label}色通道`}
              max="255"
              min="0"
              onChange={(module001Event) =>
                module001UpdateRgb(
                  module001Channel,
                  Number(module001Event.target.value),
                )
              }
              type="range"
              value={module001ChannelValue}
            />
            <output>{module001ChannelValue}</output>
          </label>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="module001ColorPicker">
      <button
        aria-controls={module001Open ? module001PanelId : undefined}
        aria-expanded={module001Open}
        aria-label={module001AriaLabel}
        className="module001ColorPickerTrigger"
        disabled={module001Disabled}
        onClick={module001TogglePanel}
        ref={module001ButtonRef}
        style={{ "--module001PickerColor": module001NormalizedValue }}
        type="button"
      >
        <span aria-hidden="true" />
      </button>
      {module001ShowValue ? <code>{module001NormalizedValue}</code> : null}
      {module001Panel ? createPortal(module001Panel, document.body) : null}
    </div>
  );
}
