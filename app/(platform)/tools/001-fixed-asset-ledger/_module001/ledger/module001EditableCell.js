"use client";

import { useState } from "react";
import Module001ColorPicker from "../components/module001ColorPicker";

/**
 * 把磁盘字段值转换成适合当前输入控件的值。
 */
function module001NormalizeInputValue(module001Type, module001Value) {
  if (module001Type === "boolean") {
    return Boolean(module001Value);
  }

  return module001Value ?? "";
}

/**
 * 渲染共用校验和提交逻辑的台账可编辑单元格。
 */
export default function Module001EditableCell({
  module001Asset,
  module001ColorPickerId = null,
  module001FieldId,
  module001Type,
  module001Value,
  module001Options = [],
  module001Disabled,
  module001Error,
  module001OnCommit,
}) {
  const [module001DraftValue, setModule001DraftValue] = useState(() =>
    module001NormalizeInputValue(module001Type, module001Value),
  );

  /** 提交文本、数字或日期输入值。 */
  function module001CommitDraft() {
    let module001NextValue = module001DraftValue;

    if (module001Type === "number") {
      module001NextValue =
        module001DraftValue === "" ? null : Number(module001DraftValue);
    }

    if (module001NextValue !== module001Value) {
      module001OnCommit(
        module001Asset.assetId,
        module001FieldId,
        module001NextValue,
      );
    }
  }

  if (module001Type === "select") {
    return (
      <select
        aria-invalid={Boolean(module001Error)}
        disabled={module001Disabled}
        onChange={(module001Event) =>
          module001OnCommit(
            module001Asset.assetId,
            module001FieldId,
            module001Event.target.value,
          )
        }
        title={module001Error ?? undefined}
        value={module001Value ?? ""}
      >
        <option value="">请选择</option>
        {module001Options.map((module001Option) => (
          <option key={module001Option.value} value={module001Option.value}>
            {module001Option.label}
          </option>
        ))}
      </select>
    );
  }

  if (module001Type === "boolean") {
    return (
      <label className="module001CellCheckbox">
        <input
          checked={Boolean(module001Value)}
          disabled={module001Disabled}
          onChange={(module001Event) =>
            module001OnCommit(
              module001Asset.assetId,
              module001FieldId,
              module001Event.target.checked,
            )
          }
          type="checkbox"
        />
        <span>{module001Value ? "是" : "否"}</span>
      </label>
    );
  }

  if (module001Type === "color") {
    return (
      <Module001ColorPicker
        module001AriaLabel="资产高亮颜色"
        module001Disabled={module001Disabled}
        module001OnChange={(module001NextColor) =>
          module001OnCommit(
            module001Asset.assetId,
            module001FieldId,
            module001NextColor,
          )
        }
        module001PickerId={module001ColorPickerId}
        module001ShowValue
        module001Value={module001Value}
      />
    );
  }

  return (
    <input
      aria-invalid={Boolean(module001Error)}
      disabled={module001Disabled}
      onBlur={module001CommitDraft}
      onChange={(module001Event) =>
        setModule001DraftValue(module001Event.target.value)
      }
      onKeyDown={(module001Event) => {
        if (module001Event.key === "Enter") {
          module001Event.currentTarget.blur();
        }
      }}
      title={module001Error ?? undefined}
      type={
        module001Type === "number" || module001Type === "date"
          ? module001Type
          : "text"
      }
      value={module001DraftValue}
    />
  );
}
