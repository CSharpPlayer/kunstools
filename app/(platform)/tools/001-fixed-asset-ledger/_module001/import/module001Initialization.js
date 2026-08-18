"use client";

import { ArrowLeft, ClipboardPaste, Check, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import Module001ColorPicker from "../components/module001ColorPicker";
import Module001Dialog from "../components/module001Dialog";
import { module001CompleteInitialization } from "../domain/module001ProjectCommands";
import Module001SceneCanvas from "../scene/module001SceneCanvas";
import { module001UseStore } from "../state/module001Store";

/**
 * 根据候选模型节点建立初始化表格的默认行。
 */
function module001CreateInitializationRows(module001Project) {
  const module001DefaultCategory = module001Project.categories[0];

  return module001Project.modelNodes
    .filter((module001Node) => module001Node.isCandidate)
    .map((module001Node) => ({
      modelNodeId: module001Node.modelNodeId,
      displayPath: module001Node.displayPath,
      selected: false,
      code: "",
      name:
        module001Node.sourceName.trim() ||
        `未命名对象 ${module001Node.sceneNodeOrdinal + 1}`,
      categoryId: module001DefaultCategory.categoryId,
      color: module001DefaultCategory.defaultColor,
    }));
}

/**
 * 解析从 Excel 复制的一列编号，并生成提交前预览。
 */
function module001AnalyzePastedCodes(module001Text, module001TargetRows) {
  const module001Codes = module001Text
    .replaceAll("\r", "")
    .split("\n")
    .map((module001Code) => module001Code.trimEnd())
    .filter((module001Code, module001Index, module001All) =>
      module001Index === module001All.length - 1
        ? module001Code.length > 0
        : true,
    );
  const module001NonEmptyCodes = module001Codes.filter(
    (module001Code) => module001Code.trim().length > 0,
  );
  const module001DuplicateCount =
    module001NonEmptyCodes.length - new Set(module001NonEmptyCodes).size;

  return {
    codes: module001Codes,
    targetCount: module001TargetRows.length,
    emptyCount: module001Codes.filter(
      (module001Code) => module001Code.trim().length === 0,
    ).length,
    duplicateCount: module001DuplicateCount,
    countMatches: module001Codes.length === module001TargetRows.length,
  };
}

/**
 * 提供首次导入后的资产对象选择和必填字段批量初始化流程。
 */
export default function Module001Initialization() {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001CloseProject = module001UseStore(
    (module001State) => module001State.closeProject,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const [module001Rows, setModule001Rows] = useState(() =>
    module001CreateInitializationRows(module001Project),
  );
  const [module001FocusedNodeId, setModule001FocusedNodeId] = useState(null);
  const [module001PasteOpen, setModule001PasteOpen] = useState(false);
  const [module001PasteText, setModule001PasteText] = useState("");
  const [module001BatchCategoryId, setModule001BatchCategoryId] = useState(
    module001Project.categories[0].categoryId,
  );
  const [module001Error, setModule001Error] = useState(null);
  const module001SelectedRows = module001Rows.filter(
    (module001Row) => module001Row.selected,
  );
  const module001PastePreview = useMemo(
    () => module001AnalyzePastedCodes(module001PasteText, module001SelectedRows),
    [module001PasteText, module001SelectedRows],
  );

  /** 更新某个候选节点的初始化字段。 */
  function module001UpdateRow(module001NodeId, module001Patch) {
    setModule001Rows((module001PreviousRows) =>
      module001PreviousRows.map((module001Row) =>
        module001Row.modelNodeId === module001NodeId
          ? { ...module001Row, ...module001Patch }
          : module001Row,
      ),
    );
  }

  /** 切换全部候选对象的资产选择状态。 */
  function module001ToggleAll(module001Selected) {
    setModule001Rows((module001PreviousRows) =>
      module001PreviousRows.map((module001Row) => ({
        ...module001Row,
        selected: module001Selected,
      })),
    );
  }

  /** 将同一类别和类别默认颜色批量应用到当前选中对象。 */
  function module001ApplyBatchCategory() {
    const module001Category = module001Project.categories.find(
      (module001Item) =>
        module001Item.categoryId === module001BatchCategoryId,
    );

    if (!module001Category) return;

    setModule001Rows((module001PreviousRows) =>
      module001PreviousRows.map((module001Row) =>
        module001Row.selected
          ? {
              ...module001Row,
              categoryId: module001Category.categoryId,
              color: module001Category.defaultColor,
            }
          : module001Row,
      ),
    );
  }

  /** 将预览通过的一列编号应用到当前选中行。 */
  function module001ApplyPastedCodes() {
    if (!module001PastePreview.countMatches) {
      return;
    }

    let module001CodeIndex = 0;
    setModule001Rows((module001PreviousRows) =>
      module001PreviousRows.map((module001Row) =>
        module001Row.selected
          ? {
              ...module001Row,
              code: module001PastePreview.codes[module001CodeIndex++],
            }
          : module001Row,
      ),
    );
    setModule001PasteOpen(false);
    setModule001PasteText("");
  }

  /** 校验并一次性提交完整初始化，作为一个可撤销命令。 */
  function module001SubmitInitialization() {
    setModule001Error(null);

    try {
      const module001Committed = module001RunProjectCommand(
        "完成资产初始化",
        (module001Draft) =>
          module001CompleteInitialization(module001Draft, module001Rows),
      );

      if (!module001Committed) {
        throw new Error("当前项目为只读，无法完成初始化");
      }
    } catch (module001SubmitError) {
      setModule001Error(
        module001SubmitError instanceof Error
          ? module001SubmitError.message
          : "初始化失败",
      );
    }
  }

  return (
    <section className="module001Initialization">
      <header className="module001WorkspaceHeader">
        <div className="module001WorkspaceTitle">
          <button
            aria-label="返回项目中心"
            className="module001IconButton"
            onClick={module001CloseProject}
            type="button"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <span className="module001Eyebrow">首次初始化</span>
            <h1>{module001Project.displayName}</h1>
          </div>
        </div>
        <div className="module001Toolbar">
          <button
            className="module001SecondaryButton"
            disabled={module001SelectedRows.length === 0 || !module001IsWriter}
            onClick={() => setModule001PasteOpen(true)}
            type="button"
          >
            <ClipboardPaste size={16} aria-hidden="true" />
            粘贴编号列
          </button>
          <button
            className="module001PrimaryButton"
            disabled={!module001IsWriter}
            onClick={module001SubmitInitialization}
            type="button"
          >
            <Check size={16} aria-hidden="true" />
            完成初始化
          </button>
        </div>
      </header>

      {!module001IsWriter ? (
        <div className="module001ReadonlyBanner" role="status">
          此项目正在另一标签页中编辑，当前只能查看。
        </div>
      ) : null}
      {module001Error ? (
        <div className="module001InlineError" role="alert">
          {module001Error}
        </div>
      ) : null}

      <div className="module001InitializationGrid">
        <div className="module001InitializationScene">
          <Module001SceneCanvas
            module001FocusedModelNodeId={module001FocusedNodeId}
            module001InitializationRows={module001Rows}
            module001OnModelNodeClick={setModule001FocusedNodeId}
          />
        </div>
        <div className="module001InitializationPanel">
          <div className="module001InitializationBatch">
            <span>批量类别</span>
            <select
              aria-label="批量类别"
              disabled={!module001IsWriter}
              onChange={(module001Event) =>
                setModule001BatchCategoryId(module001Event.target.value)
              }
              value={module001BatchCategoryId}
            >
              {module001Project.categories.map((module001Category) => (
                <option
                  key={module001Category.categoryId}
                  value={module001Category.categoryId}
                >
                  {module001Category.name}
                </option>
              ))}
            </select>
            <button
              className="module001SecondaryButton"
              disabled={module001SelectedRows.length === 0 || !module001IsWriter}
              onClick={module001ApplyBatchCategory}
              type="button"
            >
              应用到已选
            </button>
          </div>
          <div className="module001PanelHeader">
            <div>
              <Layers3 size={17} aria-hidden="true" />
              <strong>候选对象</strong>
              <span>{module001SelectedRows.length} 已选</span>
            </div>
            <label className="module001CheckboxLabel">
              <input
                checked={
                  module001Rows.length > 0 &&
                  module001SelectedRows.length === module001Rows.length
                }
                disabled={!module001IsWriter}
                onChange={(module001Event) =>
                  module001ToggleAll(module001Event.target.checked)
                }
                type="checkbox"
              />
              全选
            </label>
          </div>
          <div className="module001InitializationTableWrap">
            <table className="module001InitializationTable">
              <thead>
                <tr>
                  <th>资产</th>
                  <th>候选对象</th>
                  <th>编号</th>
                  <th>名称</th>
                  <th>类别</th>
                  <th>颜色</th>
                </tr>
              </thead>
              <tbody>
                {module001Rows.map((module001Row) => (
                  <tr
                    className={
                      module001FocusedNodeId === module001Row.modelNodeId
                        ? "module001InitializationRowFocused"
                        : ""
                    }
                    key={module001Row.modelNodeId}
                    onClick={() =>
                      setModule001FocusedNodeId(module001Row.modelNodeId)
                    }
                  >
                    <td>
                      <input
                        aria-label={`选择 ${module001Row.displayPath}`}
                        checked={module001Row.selected}
                        disabled={!module001IsWriter}
                        onChange={(module001Event) =>
                          module001UpdateRow(module001Row.modelNodeId, {
                            selected: module001Event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td title={module001Row.displayPath}>
                      {module001Row.displayPath}
                    </td>
                    <td>
                      <input
                        aria-label="资产编号"
                        disabled={!module001Row.selected || !module001IsWriter}
                        onChange={(module001Event) =>
                          module001UpdateRow(module001Row.modelNodeId, {
                            code: module001Event.target.value,
                          })
                        }
                        value={module001Row.code}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="资产名称"
                        disabled={!module001Row.selected || !module001IsWriter}
                        onChange={(module001Event) =>
                          module001UpdateRow(module001Row.modelNodeId, {
                            name: module001Event.target.value,
                          })
                        }
                        value={module001Row.name}
                      />
                    </td>
                    <td>
                      <select
                        aria-label="资产类别"
                        disabled={!module001Row.selected || !module001IsWriter}
                        onChange={(module001Event) => {
                          const module001Category =
                            module001Project.categories.find(
                              (module001Item) =>
                                module001Item.categoryId ===
                                module001Event.target.value,
                            );
                          module001UpdateRow(module001Row.modelNodeId, {
                            categoryId: module001Event.target.value,
                            color:
                              module001Category?.defaultColor ??
                              module001Row.color,
                          });
                        }}
                        value={module001Row.categoryId}
                      >
                        {module001Project.categories.map((module001Category) => (
                          <option
                            key={module001Category.categoryId}
                            value={module001Category.categoryId}
                          >
                            {module001Category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Module001ColorPicker
                        module001AriaLabel="高亮颜色"
                        module001Disabled={
                          !module001Row.selected || !module001IsWriter
                        }
                        module001OnChange={(module001NextColor) =>
                          module001UpdateRow(module001Row.modelNodeId, {
                            color: module001NextColor,
                          })
                        }
                        module001PickerId={`initialization:${module001Row.modelNodeId}`}
                        module001Value={module001Row.color}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Module001Dialog
        module001Description="编号按文本保存，可保留前导零。相同编号会组成一个多节点逻辑资产。"
        module001Open={module001PasteOpen}
        module001OnClose={() => setModule001PasteOpen(false)}
        module001Title="粘贴一列编号"
        module001Children={
          <div className="module001Form">
            <label>
              <span>从 Excel 复制的编号列</span>
              <textarea
                autoFocus
                onChange={(module001Event) =>
                  setModule001PasteText(module001Event.target.value)
                }
                placeholder={"001\n002\n003"}
                rows={9}
                value={module001PasteText}
              />
            </label>
            <div className="module001PastePreview">
              <span>目标行：{module001PastePreview.targetCount}</span>
              <span>粘贴行：{module001PastePreview.codes.length}</span>
              <span>空值：{module001PastePreview.emptyCount}</span>
              <span>重复：{module001PastePreview.duplicateCount}</span>
            </div>
            {!module001PastePreview.countMatches ? (
              <div className="module001InlineError" role="alert">
                粘贴行数与当前选中对象数量不一致
              </div>
            ) : null}
          </div>
        }
        module001Footer={
          <>
            <button
              className="module001SecondaryButton"
              onClick={() => setModule001PasteOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="module001PrimaryButton"
              disabled={!module001PastePreview.countMatches}
              onClick={module001ApplyPastedCodes}
              type="button"
            >
              应用为一次操作
            </button>
          </>
        }
      />
    </section>
  );
}
