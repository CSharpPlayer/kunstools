"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import Module001ColorPicker from "../components/module001ColorPicker";
import Module001Dialog from "../components/module001Dialog";
import { module001CreateId } from "../domain/module001Factories";
import {
  module001AddCustomField,
  module001DeleteCustomField,
} from "../domain/module001ProjectCommands";
import { module001UseStore } from "../state/module001Store";

const module001FixedFieldNames = new Set([
  "编号",
  "名称",
  "类别",
  "高亮颜色",
  "code",
  "name",
  "categoryId",
  "highlightColor",
]);

/**
 * 将字段输入文本转换成对应业务类型，无法无损转换时抛出错误。
 */
function module001ConvertFieldValue(
  module001Value,
  module001Type,
  module001Options,
) {
  if (module001Value === null || module001Value === "") {
    return null;
  }

  if (module001Type === "text") {
    return String(module001Value);
  }

  if (module001Type === "number") {
    const module001Number = Number(module001Value);
    if (!Number.isFinite(module001Number)) {
      throw new Error(`“${module001Value}”不能无损转换为数字`);
    }
    return module001Number;
  }

  if (module001Type === "date") {
    const module001Text = String(module001Value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(module001Text)) {
      throw new Error(`“${module001Value}”不是有效的无时区日期`);
    }
    return module001Text;
  }

  if (module001Type === "select") {
    const module001Text = String(module001Value);
    if (!module001Options.includes(module001Text)) {
      throw new Error(`选项“${module001Text}”不在新选项列表中`);
    }
    return module001Text;
  }

  if (typeof module001Value === "boolean") {
    return module001Value;
  }

  const module001BooleanText = String(module001Value).trim().toLowerCase();
  if (["true", "1", "是"].includes(module001BooleanText)) {
    return true;
  }
  if (["false", "0", "否"].includes(module001BooleanText)) {
    return false;
  }
  throw new Error(`“${module001Value}”不能无损转换为是/否`);
}

/**
 * 管理类别名称、默认颜色、批量设置和删除前重新分配。
 */
export function Module001CategoryManager({
  module001Open,
  module001OnClose,
}) {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const [module001Name, setModule001Name] = useState("");
  const [module001Color, setModule001Color] = useState("#2563eb");
  const [module001Error, setModule001Error] = useState(null);
  const [module001DeleteId, setModule001DeleteId] = useState(null);
  const [module001ReplacementId, setModule001ReplacementId] = useState("");
  const [module001BatchSourceId, setModule001BatchSourceId] = useState("");
  const [module001BatchTargetId, setModule001BatchTargetId] = useState("");

  /** 新增一个名称唯一的类别。 */
  function module001AddCategory(module001Event) {
    module001Event.preventDefault();
    setModule001Error(null);
    const module001TrimmedName = module001Name.trim();

    if (
      !module001TrimmedName ||
      module001Project.categories.some(
        (module001Category) =>
          module001Category.name === module001TrimmedName,
      )
    ) {
      setModule001Error("类别名称为空或已经存在");
      return;
    }

    module001RunProjectCommand("新增类别", (module001Draft) => {
      module001Draft.categories.push({
        categoryId: module001CreateId(),
        name: module001TrimmedName,
        defaultColor: module001Color,
      });
    });
    setModule001Name("");
  }

  /** 更新类别名称或默认颜色。 */
  function module001UpdateCategory(module001CategoryId, module001Patch) {
    setModule001Error(null);
    const module001NextName = module001Patch.name?.trim();

    if (
      module001NextName !== undefined &&
      (!module001NextName ||
        module001Project.categories.some(
          (module001Category) =>
            module001Category.categoryId !== module001CategoryId &&
            module001Category.name === module001NextName,
        ))
    ) {
      setModule001Error("类别名称为空或已经存在");
      return;
    }

    module001RunProjectCommand("修改类别", (module001Draft) => {
      const module001Category = module001Draft.categories.find(
        (module001Item) => module001Item.categoryId === module001CategoryId,
      );
      if (module001Category) {
        Object.assign(module001Category, {
          ...module001Patch,
          ...(module001NextName !== undefined
            ? { name: module001NextName }
            : {}),
        });
      }
    });
  }

  /** 删除类别并在需要时把受影响资产重新分配。 */
  function module001DeleteCategory() {
    if (!module001DeleteId || module001Project.categories.length <= 1) {
      return;
    }

    const module001UsageCount = module001Project.assets.filter(
      (module001Asset) => module001Asset.categoryId === module001DeleteId,
    ).length;

    if (module001UsageCount > 0 && !module001ReplacementId) {
      setModule001Error("请选择受影响资产的新类别");
      return;
    }

    module001RunProjectCommand("删除类别并重新分配资产", (module001Draft) => {
      if (module001UsageCount > 0) {
        module001Draft.assets.forEach((module001Asset) => {
          if (module001Asset.categoryId === module001DeleteId) {
            module001Asset.categoryId = module001ReplacementId;
          }
        });
      }
      module001Draft.categories = module001Draft.categories.filter(
        (module001Category) =>
          module001Category.categoryId !== module001DeleteId,
      );
    });
    setModule001DeleteId(null);
    setModule001ReplacementId("");
  }

  /** 按原类别一次性批量设置资产类别。 */
  function module001ApplyBatchCategory() {
    if (
      !module001BatchSourceId ||
      !module001BatchTargetId ||
      module001BatchSourceId === module001BatchTargetId
    ) {
      return;
    }

    module001RunProjectCommand("批量设置资产类别", (module001Draft) => {
      module001Draft.assets.forEach((module001Asset) => {
        if (module001Asset.categoryId === module001BatchSourceId) {
          module001Asset.categoryId = module001BatchTargetId;
        }
      });
    });
  }

  const module001DeleteUsage = module001DeleteId
    ? module001Project.assets.filter(
        (module001Asset) => module001Asset.categoryId === module001DeleteId,
      ).length
    : 0;

  return (
    <Module001Dialog
      module001Description="类别默认色会立即影响未设置单项覆盖色的资产。"
      module001Open={module001Open}
      module001OnClose={module001OnClose}
      module001Title="类别管理"
      module001Children={
        <div className="module001ManagerBody">
          {module001Error ? (
            <div className="module001InlineError" role="alert">
              {module001Error}
            </div>
          ) : null}
          <div className="module001ManagerList">
            {module001Project.categories.map((module001Category) => (
              <div className="module001ManagerRow" key={module001Category.categoryId}>
                <input
                  aria-label="类别名称"
                  defaultValue={module001Category.name}
                  disabled={!module001IsWriter}
                  onBlur={(module001Event) =>
                    module001UpdateCategory(module001Category.categoryId, {
                      name: module001Event.target.value,
                    })
                  }
                />
                <Module001ColorPicker
                  module001AriaLabel="类别默认颜色"
                  module001Disabled={!module001IsWriter}
                  module001OnChange={(module001NextColor) =>
                    module001UpdateCategory(module001Category.categoryId, {
                      defaultColor: module001NextColor,
                    })
                  }
                  module001PickerId={`category:${module001Category.categoryId}`}
                  module001Value={module001Category.defaultColor}
                />
                <span>
                  {
                    module001Project.assets.filter(
                      (module001Asset) =>
                        module001Asset.categoryId === module001Category.categoryId,
                    ).length
                  }{" "}
                  项
                </span>
                <button
                  aria-label={`删除类别 ${module001Category.name}`}
                  className="module001IconButton"
                  disabled={
                    !module001IsWriter || module001Project.categories.length <= 1
                  }
                  onClick={() => {
                    setModule001DeleteId(module001Category.categoryId);
                    setModule001ReplacementId("");
                  }}
                  type="button"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <form className="module001ManagerAdd" onSubmit={module001AddCategory}>
            <input
              aria-label="新类别名称"
              disabled={!module001IsWriter}
              onChange={(module001Event) =>
                setModule001Name(module001Event.target.value)
              }
              placeholder="新类别名称"
              value={module001Name}
            />
            <Module001ColorPicker
              module001AriaLabel="新类别颜色"
              module001Disabled={!module001IsWriter}
              module001OnChange={setModule001Color}
              module001PickerId="category:new"
              module001Value={module001Color}
            />
            <button
              className="module001SecondaryButton"
              disabled={!module001IsWriter}
              type="submit"
            >
              <Plus size={14} aria-hidden="true" />
              添加
            </button>
          </form>
          <div className="module001ManagerBatch">
            <strong>批量设置类别</strong>
            <select
              aria-label="原类别"
              onChange={(module001Event) =>
                setModule001BatchSourceId(module001Event.target.value)
              }
              value={module001BatchSourceId}
            >
              <option value="">原类别</option>
              {module001Project.categories.map((module001Category) => (
                <option key={module001Category.categoryId} value={module001Category.categoryId}>
                  {module001Category.name}
                </option>
              ))}
            </select>
            <select
              aria-label="目标类别"
              onChange={(module001Event) =>
                setModule001BatchTargetId(module001Event.target.value)
              }
              value={module001BatchTargetId}
            >
              <option value="">目标类别</option>
              {module001Project.categories.map((module001Category) => (
                <option key={module001Category.categoryId} value={module001Category.categoryId}>
                  {module001Category.name}
                </option>
              ))}
            </select>
            <button
              className="module001SecondaryButton"
              disabled={!module001IsWriter}
              onClick={module001ApplyBatchCategory}
              type="button"
            >
              应用
            </button>
          </div>
          {module001DeleteId ? (
            <div className="module001ManagerWarning">
              <strong>删除类别</strong>
              <span>将影响 {module001DeleteUsage} 项资产。</span>
              {module001DeleteUsage > 0 ? (
                <select
                  aria-label="重新分配到"
                  onChange={(module001Event) =>
                    setModule001ReplacementId(module001Event.target.value)
                  }
                  value={module001ReplacementId}
                >
                  <option value="">选择新类别</option>
                  {module001Project.categories
                    .filter(
                      (module001Category) =>
                        module001Category.categoryId !== module001DeleteId,
                    )
                    .map((module001Category) => (
                      <option
                        key={module001Category.categoryId}
                        value={module001Category.categoryId}
                      >
                        {module001Category.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <button
                className="module001DangerButton"
                onClick={module001DeleteCategory}
                type="button"
              >
                确认删除
              </button>
            </div>
          ) : null}
        </div>
      }
      module001Footer={
        <button
          className="module001PrimaryButton"
          onClick={module001OnClose}
          type="button"
        >
          完成
        </button>
      }
    />
  );
}

/**
 * 管理自定义字段的新增、转换、选项和删除影响预览。
 */
export function Module001FieldManager({
  module001Open,
  module001OnClose,
}) {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const [module001Name, setModule001Name] = useState("");
  const [module001Type, setModule001Type] = useState("text");
  const [module001Required, setModule001Required] = useState(false);
  const [module001Default, setModule001Default] = useState("");
  const [module001OptionsText, setModule001OptionsText] = useState("");
  const [module001Error, setModule001Error] = useState(null);
  const [module001DeleteId, setModule001DeleteId] = useState(null);

  const module001Options = useMemo(
    () =>
      module001OptionsText
        .split("\n")
        .map((module001Option) => module001Option.trim())
        .filter(Boolean),
    [module001OptionsText],
  );

  /** 将新增字段表单提交为一次可撤销命令。 */
  function module001SubmitField(module001Event) {
    module001Event.preventDefault();
    setModule001Error(null);

    try {
      const module001DefaultValue = module001ConvertFieldValue(
        module001Default,
        module001Type,
        module001Options,
      );
      module001RunProjectCommand("新增自定义字段", (module001Draft) =>
        module001AddCustomField(module001Draft, {
          name: module001Name,
          type: module001Type,
          required: module001Required,
          defaultValue: module001DefaultValue,
          options: module001Options,
        }),
      );
      setModule001Name("");
      setModule001Default("");
      setModule001OptionsText("");
      setModule001Required(false);
    } catch (module001FieldError) {
      setModule001Error(
        module001FieldError instanceof Error
          ? module001FieldError.message
          : "字段新增失败",
      );
    }
  }

  /** 预览并提交字段类型或选项变更，无法无损转换时阻止提交。 */
  function module001UpdateField(
    module001FieldId,
    module001Patch,
  ) {
    setModule001Error(null);

    try {
      module001RunProjectCommand("修改自定义字段", (module001Draft) => {
        const module001Field = module001Draft.customFields.find(
          (module001Item) => module001Item.fieldId === module001FieldId,
        );

        if (!module001Field) {
          throw new Error("找不到自定义字段");
        }

        const module001NextField = { ...module001Field, ...module001Patch };
        const module001NextOptions = module001NextField.options ?? [];
        const module001NextName = module001NextField.name.trim();

        if (
          !module001NextName ||
          module001FixedFieldNames.has(module001NextName) ||
          module001Draft.customFields.some(
            (module001Item) =>
              module001Item.fieldId !== module001FieldId &&
              module001Item.name === module001NextName,
          )
        ) {
          throw new Error("字段名为空、重复或与固定字段冲突");
        }
        if (
          module001NextField.type === "select" &&
          (module001NextOptions.length === 0 ||
            new Set(module001NextOptions).size !== module001NextOptions.length)
        ) {
          throw new Error("单选字段必须提供不重复的有效选项");
        }

        module001NextField.name = module001NextName;
        module001NextField.defaultValue = module001ConvertFieldValue(
          module001NextField.defaultValue,
          module001NextField.type,
          module001NextOptions,
        );
        const module001ConvertedValues = module001Draft.assets.map(
          (module001Asset) =>
            module001ConvertFieldValue(
              module001Asset.customValues[module001FieldId] ?? null,
              module001NextField.type,
              module001NextOptions,
            ),
        );

        if (
          module001NextField.required &&
          module001ConvertedValues.some(
            (module001Value) => module001Value === null || module001Value === "",
          )
        ) {
          throw new Error("现有资产存在空值，不能直接改为必填字段");
        }

        Object.assign(module001Field, module001NextField);
        module001Draft.assets.forEach((module001Asset, module001Index) => {
          module001Asset.customValues[module001FieldId] =
            module001ConvertedValues[module001Index];
        });
      });
    } catch (module001FieldError) {
      setModule001Error(
        module001FieldError instanceof Error
          ? module001FieldError.message
          : "字段修改失败",
      );
    }
  }

  /** 删除字段和全部对应值，并显示受影响资产数量。 */
  function module001ConfirmDeleteField() {
    if (!module001DeleteId) {
      return;
    }

    module001RunProjectCommand("删除自定义字段", (module001Draft) =>
      module001DeleteCustomField(module001Draft, module001DeleteId),
    );
    setModule001DeleteId(null);
  }

  return (
    <Module001Dialog
      module001Description="修改类型、选项或删除字段前会检查全部现有记录。"
      module001Open={module001Open}
      module001OnClose={module001OnClose}
      module001Title="字段管理"
      module001Children={
        <div className="module001ManagerBody">
          {module001Error ? (
            <div className="module001InlineError" role="alert">
              {module001Error}
            </div>
          ) : null}
          <div className="module001FieldList">
            {module001Project.customFields.length === 0 ? (
              <span className="module001MutedText">尚未添加自定义字段</span>
            ) : null}
            {module001Project.customFields.map((module001Field) => (
              <div className="module001FieldRow" key={module001Field.fieldId}>
                <input
                  aria-label="字段名称"
                  defaultValue={module001Field.name}
                  disabled={!module001IsWriter}
                  onBlur={(module001Event) =>
                    module001UpdateField(module001Field.fieldId, {
                      name: module001Event.target.value.trim(),
                    })
                  }
                />
                <select
                  aria-label="字段类型"
                  disabled={!module001IsWriter}
                  onChange={(module001Event) =>
                    module001UpdateField(module001Field.fieldId, {
                      type: module001Event.target.value,
                    })
                  }
                  value={module001Field.type}
                >
                  <option value="text">文本</option>
                  <option value="number">数字</option>
                  <option value="date">日期</option>
                  <option value="select">单选</option>
                  <option value="boolean">是/否</option>
                </select>
                <label className="module001CheckboxLabel">
                  <input
                    checked={module001Field.required}
                    disabled={!module001IsWriter}
                    onChange={(module001Event) =>
                      module001UpdateField(module001Field.fieldId, {
                        required: module001Event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  必填
                </label>
                {module001Field.type === "select" ? (
                  <input
                    aria-label="单选选项，以逗号分隔"
                    defaultValue={module001Field.options.join(",")}
                    disabled={!module001IsWriter}
                    onBlur={(module001Event) =>
                      module001UpdateField(module001Field.fieldId, {
                        options: module001Event.target.value
                          .split(",")
                          .map((module001Option) => module001Option.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                ) : (
                  <span />
                )}
                <button
                  aria-label={`删除字段 ${module001Field.name}`}
                  className="module001IconButton"
                  disabled={!module001IsWriter}
                  onClick={() => setModule001DeleteId(module001Field.fieldId)}
                  type="button"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <form className="module001FieldAddForm" onSubmit={module001SubmitField}>
            <strong>新增字段</strong>
            <input
              aria-label="新字段名称"
              disabled={!module001IsWriter}
              onChange={(module001Event) =>
                setModule001Name(module001Event.target.value)
              }
              placeholder="字段名称"
              required
              value={module001Name}
            />
            <select
              aria-label="新字段类型"
              disabled={!module001IsWriter}
              onChange={(module001Event) =>
                setModule001Type(module001Event.target.value)
              }
              value={module001Type}
            >
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="date">日期</option>
              <option value="select">单选</option>
              <option value="boolean">是/否</option>
            </select>
            <label className="module001CheckboxLabel">
              <input
                checked={module001Required}
                disabled={!module001IsWriter}
                onChange={(module001Event) =>
                  setModule001Required(module001Event.target.checked)
                }
                type="checkbox"
              />
              必填
            </label>
            <input
              aria-label="默认值"
              disabled={!module001IsWriter}
              onChange={(module001Event) =>
                setModule001Default(module001Event.target.value)
              }
              placeholder="默认值"
              value={module001Default}
            />
            {module001Type === "select" ? (
              <textarea
                aria-label="单选选项"
                disabled={!module001IsWriter}
                onChange={(module001Event) =>
                  setModule001OptionsText(module001Event.target.value)
                }
                placeholder="每行一个选项"
                rows={4}
                value={module001OptionsText}
              />
            ) : null}
            <button
              className="module001SecondaryButton"
              disabled={!module001IsWriter}
              type="submit"
            >
              <Plus size={14} aria-hidden="true" />
              添加字段
            </button>
          </form>
          {module001DeleteId ? (
            <div className="module001ManagerWarning">
              <strong>删除字段</strong>
              <span>
                将从 {module001Project.assets.length} 项资产中永久移除此字段值。
              </span>
              <button
                className="module001DangerButton"
                onClick={module001ConfirmDeleteField}
                type="button"
              >
                确认删除
              </button>
            </div>
          ) : null}
        </div>
      }
      module001Footer={
        <button
          className="module001PrimaryButton"
          onClick={module001OnClose}
          type="button"
        >
          完成
        </button>
      }
    />
  );
}
