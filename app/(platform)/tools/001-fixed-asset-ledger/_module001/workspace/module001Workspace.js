"use client";

import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Module001AssetDetails from "../assetEditor/module001AssetDetails";
import Module001Dialog from "../components/module001Dialog";
import {
  module001AddAsset,
  module001DeleteAsset,
  module001MergeAssets,
  module001SplitAsset,
} from "../domain/module001ProjectCommands";
import { module001ValidateCustomValue } from "../domain/module001Schemas";
import {
  module001ChooseXlsxSaveHandle,
  module001ExportLedgerXlsx,
} from "../export/module001Xlsx";
import { module001SaveCurrentViewAsCover } from "../export/module001Preview";
import {
  module001ChooseZipSaveHandle,
  module001ExportProjectZip,
} from "../export/module001Zip";
import Module001Ledger from "../ledger/module001Ledger";
import {
  Module001CategoryManager,
  Module001FieldManager,
} from "../ledger/module001Managers";
import Module001SceneCanvas from "../scene/module001SceneCanvas";
import { module001UseStore } from "../state/module001Store";
import {
  module001CreateWritable,
  module001EnsureDirectoryPermission,
} from "./module001FileSystem";
import { module001AcquireProjectLock } from "./module001ProjectLock";
import { module001SaveProject } from "./module001ProjectRepository";

const module001FixedAssetFields = new Set([
  "code",
  "name",
  "categoryId",
]);

/**
 * 返回当前保存状态对应的简体中文说明。
 */
function module001SaveStatusLabel(
  module001Status,
  module001Error,
) {
  if (module001Status === "saving") return "正在保存";
  if (module001Status === "dirty") return "等待保存";
  if (module001Status === "saved") return "已保存";
  if (module001Status === "readonly") return "只读";
  if (module001Status === "error") return module001Error || "保存失败";
  return "";
}

/**
 * 将字段值转换成合并冲突预览使用的可读文本。
 */
function module001FormatConflictValue(
  module001Project,
  module001FieldId,
  module001Value,
) {
  if (module001FieldId === "categoryId") {
    return (
      module001Project.categories.find(
        (module001Category) =>
          module001Category.categoryId === module001Value,
      )?.name ?? "未设置"
    );
  }

  if (typeof module001Value === "boolean") {
    return module001Value ? "是" : "否";
  }

  return module001Value === null || module001Value === ""
    ? "未设置"
    : String(module001Value);
}

/**
 * 按字段定义渲染拆分向导中的必填值，确保数字和布尔值不会被误存为文本。
 */
function Module001SplitRequiredField({
  module001Field,
  module001Value,
  module001OnChange,
}) {
  if (module001Field.type === "select") {
    return (
      <select
        required
        value={module001Value ?? ""}
        onChange={(module001Event) =>
          module001OnChange(module001Event.target.value || null)
        }
      >
        <option value="">请选择</option>
        {module001Field.options.map((module001Option) => (
          <option key={module001Option} value={module001Option}>
            {module001Option}
          </option>
        ))}
      </select>
    );
  }

  if (module001Field.type === "boolean") {
    return (
      <select
        required
        value={
          module001Value === null || module001Value === undefined
            ? ""
            : String(module001Value)
        }
        onChange={(module001Event) =>
          module001OnChange(
            module001Event.target.value === ""
              ? null
              : module001Event.target.value === "true",
          )
        }
      >
        <option value="">请选择</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    );
  }

  return (
    <input
      required
      type={
        module001Field.type === "number" || module001Field.type === "date"
          ? module001Field.type
          : "text"
      }
      value={module001Value ?? ""}
      onChange={(module001Event) =>
        module001OnChange(
          module001Field.type === "number"
            ? module001Event.target.value === ""
              ? null
              : Number(module001Event.target.value)
            : module001Event.target.value,
        )
      }
    />
  );
}

/**
 * 提供模块工作区、双向联动、详情、关联和导出功能。
 */
export default function Module001Workspace() {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001ProjectDirectory = module001UseStore(
    (module001State) => module001State.projectDirectory,
  );
  const module001WorkspaceHandle = module001UseStore(
    (module001State) => module001State.workspaceHandle,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const module001SaveStatus = module001UseStore(
    (module001State) => module001State.saveStatus,
  );
  const module001SaveError = module001UseStore(
    (module001State) => module001State.saveError,
  );
  const module001UndoStack = module001UseStore(
    (module001State) => module001State.undoStack,
  );
  const module001RedoStack = module001UseStore(
    (module001State) => module001State.redoStack,
  );
  const module001SelectedAssetId = module001UseStore(
    (module001State) => module001State.selectedAssetId,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001UpdateProjectUi = module001UseStore(
    (module001State) => module001State.updateProjectUi,
  );
  const module001SetSelectedAssetId = module001UseStore(
    (module001State) => module001State.setSelectedAssetId,
  );
  const module001SetSaveState = module001UseStore(
    (module001State) => module001State.setSaveState,
  );
  const module001SetOperation = module001UseStore(
    (module001State) => module001State.setOperation,
  );
  const module001SetWriterLock = module001UseStore(
    (module001State) => module001State.setWriterLock,
  );
  const module001CloseProject = module001UseStore(
    (module001State) => module001State.closeProject,
  );
  const module001Undo = module001UseStore(
    (module001State) => module001State.undo,
  );
  const module001Redo = module001UseStore(
    (module001State) => module001State.redo,
  );
  const [module001Dialog, setModule001Dialog] = useState(null);
  const [module001CategoryOpen, setModule001CategoryOpen] = useState(false);
  const [module001FieldOpen, setModule001FieldOpen] = useState(false);
  const [module001Error, setModule001Error] = useState(null);
  const [module001FilteredAssetIds, setModule001FilteredAssetIds] = useState(
    module001Project.assets.map((module001Asset) => module001Asset.assetId),
  );
  const [module001LedgerPercent, setModule001LedgerPercent] = useState(
    module001Project.layout.ledgerPercent,
  );
  const [module001Form, setModule001Form] = useState({});
  const [module001MergeTargetId, setModule001MergeTargetId] = useState("");
  const [module001MergeChoices, setModule001MergeChoices] = useState({});
  const [module001ExportScope, setModule001ExportScope] = useState("all");
  const module001WorkAreaRef = useRef(null);
  const module001DraggingRef = useRef(false);
  const module001LedgerPercentRef = useRef(module001LedgerPercent);
  const module001SceneApiRef = useRef(null);
  const module001AbortRef = useRef(null);

  useEffect(() => {
    if (!module001DraggingRef.current) {
      setModule001LedgerPercent(module001Project.layout.ledgerPercent);
      module001LedgerPercentRef.current =
        module001Project.layout.ledgerPercent;
    }
  }, [module001Project.layout.ledgerPercent]);

  /** 提交固定字段、自定义字段或颜色继承状态。 */
  function module001CommitAssetField(
    module001AssetId,
    module001FieldId,
    module001Value,
  ) {
      const module001Asset = module001Project.assets.find(
        (module001Item) => module001Item.assetId === module001AssetId,
      );

      if (!module001Asset) {
        return;
      }

      if (module001FieldId === "code") {
        const module001Existing = module001Project.assets.find(
          (module001Item) =>
            module001Item.assetId !== module001AssetId &&
            module001Item.code.trim() === String(module001Value).trim() &&
            String(module001Value).trim(),
        );
        if (module001Existing) {
          setModule001MergeTargetId(module001Existing.assetId);
          setModule001MergeChoices({ code: "target" });
          setModule001Dialog({
            type: "merge",
            sourceAssetId: module001AssetId,
            requestedCode: module001Value,
            fixedTarget: true,
          });
          return;
        }
      }

      if (!module001FixedAssetFields.has(module001FieldId)) {
        const module001Field = module001Project.customFields.find(
          (module001Item) => module001Item.fieldId === module001FieldId,
        );
        if (module001Field) {
          const module001ValueError = module001ValidateCustomValue(
            module001Field,
            module001Value,
          );
          if (module001ValueError) {
            setModule001Error(`${module001Field.name}：${module001ValueError}`);
          }
        }
      }

      module001RunProjectCommand("编辑资产详情", (module001Draft) => {
        const module001DraftAsset = module001Draft.assets.find(
          (module001Item) => module001Item.assetId === module001AssetId,
        );
        if (!module001DraftAsset) return;

        if (module001FieldId === "highlightColor") {
          const module001DefaultColor = module001Draft.categories.find(
            (module001Category) =>
              module001Category.categoryId === module001DraftAsset.categoryId,
          )?.defaultColor;
          module001DraftAsset.highlightColorOverride =
            module001DefaultColor?.toLowerCase() ===
            String(module001Value).toLowerCase()
              ? null
              : module001Value;
        } else if (module001FieldId === "highlightColorReset") {
          module001DraftAsset.highlightColorOverride = null;
        } else if (module001FixedAssetFields.has(module001FieldId)) {
          module001DraftAsset[module001FieldId] = module001Value;
        } else {
          module001DraftAsset.customValues[module001FieldId] = module001Value;
        }
      });
  }

  /** 打开显式资产合并对话框。 */
  function module001OpenMerge(module001SourceAssetId) {
    const module001Target = module001Project.assets.find(
      (module001Asset) => module001Asset.assetId !== module001SourceAssetId,
    );

    if (!module001Target) {
      setModule001Error("至少需要两项资产才能合并");
      return;
    }

    setModule001MergeTargetId(module001Target.assetId);
    setModule001MergeChoices({});
    setModule001Dialog({
      type: "merge",
      sourceAssetId: module001SourceAssetId,
      fixedTarget: false,
    });
  }

  /** 提交逐字段选择后的资产合并。 */
  function module001ConfirmMerge() {
    const module001Source = module001Project.assets.find(
      (module001Asset) =>
        module001Asset.assetId === module001Dialog?.sourceAssetId,
    );
    const module001Target = module001Project.assets.find(
      (module001Asset) => module001Asset.assetId === module001MergeTargetId,
    );

    if (!module001Source || !module001Target) {
      return;
    }

    const module001Pick = (module001FieldId, module001SourceValue, module001TargetValue) =>
      module001MergeChoices[module001FieldId] === "source"
        ? module001SourceValue
        : module001TargetValue;
    const module001ResolvedCustomValues = Object.fromEntries(
      module001Project.customFields.map((module001Field) => [
        module001Field.fieldId,
        module001Pick(
          module001Field.fieldId,
          module001Source.customValues[module001Field.fieldId] ?? null,
          module001Target.customValues[module001Field.fieldId] ?? null,
        ),
      ]),
    );

    module001RunProjectCommand("合并资产", (module001Draft) =>
      module001MergeAssets(
        module001Draft,
        module001Target.assetId,
        module001Source.assetId,
        {
          code: module001Dialog.requestedCode ??
            module001Pick("code", module001Source.code, module001Target.code),
          name: module001Pick("name", module001Source.name, module001Target.name),
          categoryId: module001Pick(
            "categoryId",
            module001Source.categoryId,
            module001Target.categoryId,
          ),
          highlightColorOverride: module001Pick(
            "highlightColorOverride",
            module001Source.highlightColorOverride,
            module001Target.highlightColorOverride,
          ),
          customValues: module001ResolvedCustomValues,
        },
      ),
    );
    module001SetSelectedAssetId(module001Target.assetId);
    setModule001Dialog(null);
  }

  /** 新增资产并关联选中的未配置模型节点。 */
  function module001ConfirmAddAsset(module001Event) {
    module001Event.preventDefault();
    setModule001Error(null);

    try {
      let module001CreatedId = null;
      module001RunProjectCommand("新增资产", (module001Draft) => {
        const module001Asset = module001AddAsset(module001Draft, {
          module001Code: module001Form.code ?? "",
          module001Name: module001Form.name ?? "",
          module001CategoryId:
            module001Form.categoryId ?? module001Draft.categories[0].categoryId,
          module001ModelNodeIds: module001Form.nodeIds ?? [],
        });
        module001CreatedId = module001Asset.assetId;
      });
      module001SetSelectedAssetId(module001CreatedId);
      setModule001Dialog(null);
    } catch (module001AddError) {
      setModule001Error(
        module001AddError instanceof Error
          ? module001AddError.message
          : "新增资产失败",
      );
    }
  }

  /** 删除资产并将节点退回未配置列表。 */
  function module001ConfirmDeleteAsset() {
    const module001AssetId = module001Dialog?.assetId;
    if (!module001AssetId) return;

    module001RunProjectCommand("删除资产", (module001Draft) =>
      module001DeleteAsset(module001Draft, module001AssetId),
    );
    module001SetSelectedAssetId(null);
    setModule001Dialog(null);
  }

  /** 将选中的未配置节点关联到当前资产。 */
  function module001ConfirmAddNodes() {
    const module001AssetId = module001Dialog?.assetId;
    const module001NodeIds = module001Form.nodeIds ?? [];

    if (!module001AssetId || module001NodeIds.length === 0) return;
    module001RunProjectCommand("添加资产模型节点", (module001Draft) => {
      const module001Asset = module001Draft.assets.find(
        (module001Item) => module001Item.assetId === module001AssetId,
      );
      if (!module001Asset) return;
      module001Asset.modelNodeIds.push(...module001NodeIds);
      module001Asset.modelNodeIds = [...new Set(module001Asset.modelNodeIds)];
      module001Draft.modelNodes.forEach((module001Node) => {
        if (module001NodeIds.includes(module001Node.modelNodeId)) {
          module001Node.assetId = module001AssetId;
          module001Node.isAssetObject = true;
        }
      });
    });
    setModule001Dialog(null);
  }

  /** 移除一个节点关联并退回未配置对象列表。 */
  function module001RemoveNode(
    module001AssetId,
    module001NodeId,
  ) {
    module001RunProjectCommand("移除资产模型节点", (module001Draft) => {
      const module001Asset = module001Draft.assets.find(
        (module001Item) => module001Item.assetId === module001AssetId,
      );
      if (!module001Asset || module001Asset.modelNodeIds.length <= 1) return;
      module001Asset.modelNodeIds = module001Asset.modelNodeIds.filter(
        (module001Id) => module001Id !== module001NodeId,
      );
      const module001Node = module001Draft.modelNodes.find(
        (module001Item) => module001Item.modelNodeId === module001NodeId,
      );
      if (module001Node) {
        module001Node.assetId = null;
        module001Node.isAssetObject = false;
      }
    });
  }

  /** 提交多节点资产拆分向导。 */
  function module001ConfirmSplit(module001Event) {
    module001Event.preventDefault();
    setModule001Error(null);

    try {
      let module001NewAssetId = null;
      module001RunProjectCommand("拆分资产", (module001Draft) => {
        const module001NewAsset = module001SplitAsset(
          module001Draft,
          module001Dialog.assetId,
          {
            module001NodeIds: module001Form.nodeIds ?? [],
            module001Code: module001Form.code ?? "",
            module001Name: module001Form.name ?? "",
            module001CustomValues: module001Form.customValues ?? {},
          },
        );
        module001NewAssetId = module001NewAsset.assetId;
      });
      module001SetSelectedAssetId(module001NewAssetId);
      setModule001Dialog(null);
    } catch (module001SplitError) {
      setModule001Error(
        module001SplitError instanceof Error
          ? module001SplitError.message
          : "拆分资产失败",
      );
    }
  }

  /** 在拖动分隔条时只更新局部布局，松开后持久化。 */
  function module001StartResize(module001Event) {
    if (!module001WorkAreaRef.current) return;
    module001Event.preventDefault();
    module001DraggingRef.current = true;

    /** 根据指针位置更新右侧台账比例。 */
    function module001HandlePointerMove(module001MoveEvent) {
      const module001Rect =
        module001WorkAreaRef.current.getBoundingClientRect();
      const module001Next = Math.max(
        24,
        Math.min(
          70,
          100 -
            ((module001MoveEvent.clientX - module001Rect.left) /
              module001Rect.width) *
              100,
        ),
      );
      module001LedgerPercentRef.current = module001Next;
      setModule001LedgerPercent(module001Next);
    }

    /** 结束拖动并把最终比例写入项目设置。 */
    function module001HandlePointerUp() {
      module001DraggingRef.current = false;
      window.removeEventListener("pointermove", module001HandlePointerMove);
      window.removeEventListener("pointerup", module001HandlePointerUp);
      module001UpdateProjectUi((module001Draft) => {
        module001Draft.layout.ledgerPercent =
          module001LedgerPercentRef.current;
      });
    }

    window.addEventListener("pointermove", module001HandlePointerMove);
    window.addEventListener("pointerup", module001HandlePointerUp);
  }

  /** 重新申请当前项目的独占编辑锁。 */
  async function module001RetryWriterLock() {
    const module001Controller = await module001AcquireProjectLock(
      module001Project.projectId,
    );
    module001SetWriterLock(module001Controller);
  }

  /** 在用户点击后重新请求工作区读写权限。 */
  async function module001ReconnectPermission() {
    const module001Granted = await module001EnsureDirectoryPermission(
      module001WorkspaceHandle,
      true,
    );
    if (!module001Granted) {
      setModule001Error("未取得工作区读写权限");
      return;
    }
    module001SetSaveState("dirty");
  }

  /** 立即重试当前项目保存。 */
  async function module001RetrySave() {
    try {
      module001SetSaveState("saving");
      await module001SaveProject(module001ProjectDirectory, module001Project);
      module001SetSaveState("saved");
    } catch (module001RetryError) {
      module001SetSaveState(
        "error",
        module001RetryError instanceof Error
          ? module001RetryError.message
          : "保存重试失败",
      );
    }
  }

  /** 将当前内存项目另存为独立 JSON 应急副本。 */
  async function module001ExportEmergencyCopy() {
    if (typeof window.showSaveFilePicker !== "function") return;
    const module001Handle = await window.showSaveFilePicker({
      suggestedName: `${module001Project.displayName}-应急副本.json`,
      types: [
        {
          description: "项目 JSON 应急副本",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const module001Writable = await module001CreateWritable(module001Handle);
    await module001Writable.write(
      `${JSON.stringify(module001Project, null, 2)}\n`,
    );
    await module001Writable.close();
  }

  /** 导出全部资产或当前筛选结果的独立 XLSX。 */
  async function module001ConfirmXlsxExport() {
    try {
      const module001Handle = await module001ChooseXlsxSaveHandle(
        module001Project.displayName,
      );
      setModule001Dialog(null);
      module001SetOperation({
        title: "正在生成 XLSX",
        detail: "整理当前台账列和字段类型",
        ratio: 0.25,
        cancelable: false,
      });
      const module001Assets =
        module001ExportScope === "filtered"
          ? module001Project.assets.filter((module001Asset) =>
              module001FilteredAssetIds.includes(module001Asset.assetId),
            )
          : module001Project.assets;
      await module001ExportLedgerXlsx({
        module001Project,
        module001ProjectDirectory,
        module001Assets,
        module001StandaloneHandle: module001Handle,
      });
      module001SetOperation(null);
    } catch (module001ExportError) {
      module001SetOperation(null);
      if (module001ExportError?.name !== "AbortError") {
        setModule001Error(
          module001ExportError instanceof Error
            ? module001ExportError.message
            : "XLSX 导出失败",
        );
      }
    }
  }

  /** 流式导出当前项目标准 ZIP。 */
  async function module001HandleZipExport() {
    try {
      const module001Handle = await module001ChooseZipSaveHandle(
        module001Project.displayName,
      );
      const module001Controller = new AbortController();
      module001AbortRef.current = module001Controller;
      module001SetOperation({
        title: "正在导出项目 ZIP",
        detail: "准备项目文件",
        ratio: 0,
        cancelable: true,
        onCancel: () => module001Controller.abort(),
      });
      await module001ExportProjectZip({
        module001Project,
        module001ProjectDirectory,
        module001SaveHandle: module001Handle,
        module001Signal: module001Controller.signal,
        module001OnProgress: ({ fileName, ratio }) =>
          module001SetOperation({
            title: "正在导出项目 ZIP",
            detail:
              fileName === "complete" ? "正在完成 ZIP" : `写入 ${fileName}`,
            ratio,
            cancelable: fileName !== "complete",
            onCancel: () => module001Controller.abort(),
          }),
      });
    } catch (module001ExportError) {
      if (module001ExportError?.name !== "AbortError") {
        setModule001Error(
          module001ExportError instanceof Error
            ? module001ExportError.message
            : "ZIP 导出失败",
        );
      }
    } finally {
      module001AbortRef.current = null;
      module001SetOperation(null);
    }
  }

  /** 保存当前三维相机和单次截图为项目封面。 */
  async function module001HandleSaveCover() {
    try {
      const module001Camera = await module001SaveCurrentViewAsCover({
        module001SceneApi: module001SceneApiRef.current,
        module001ProjectDirectory,
      });
      module001RunProjectCommand("设置项目封面", (module001Draft) => {
        module001Draft.coverCamera = module001Camera;
      });
    } catch (module001CoverError) {
      setModule001Error(
        module001CoverError instanceof Error
          ? module001CoverError.message
          : "封面保存失败",
      );
    }
  }

  const module001SourceAsset = module001Project.assets.find(
    (module001Asset) =>
      module001Asset.assetId === module001Dialog?.sourceAssetId,
  );
  const module001TargetAsset = module001Project.assets.find(
    (module001Asset) => module001Asset.assetId === module001MergeTargetId,
  );
  const module001ConflictFields = (() => {
    if (!module001SourceAsset || !module001TargetAsset) return [];
    const module001Fields = [
      { id: "code", name: "编号", source: module001SourceAsset.code, target: module001TargetAsset.code },
      { id: "name", name: "名称", source: module001SourceAsset.name, target: module001TargetAsset.name },
      { id: "categoryId", name: "类别", source: module001SourceAsset.categoryId, target: module001TargetAsset.categoryId },
      { id: "highlightColorOverride", name: "单项颜色", source: module001SourceAsset.highlightColorOverride, target: module001TargetAsset.highlightColorOverride },
      ...module001Project.customFields.map((module001Field) => ({
        id: module001Field.fieldId,
        name: module001Field.name,
        source: module001SourceAsset.customValues[module001Field.fieldId] ?? null,
        target: module001TargetAsset.customValues[module001Field.fieldId] ?? null,
      })),
    ];
    return module001Fields.filter(
      (module001Field) =>
        JSON.stringify(module001Field.source) !== JSON.stringify(module001Field.target),
    );
  })();
  const module001AvailableNodes = module001Project.modelNodes.filter(
    (module001Node) => module001Node.isCandidate && !module001Node.assetId,
  );
  const module001DialogAsset = module001Project.assets.find(
    (module001Asset) => module001Asset.assetId === module001Dialog?.assetId,
  );
  const module001LedgerHidden =
    module001Project.layout.ledgerCollapsed ||
    module001Project.layout.sceneMaximized;

  return (
    <section className="module001WorkspaceView">
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
            <span className="module001Eyebrow">三维台账</span>
            <h1>{module001Project.displayName}</h1>
          </div>
          <span
            className={`module001SaveStatus module001SaveStatus-${module001SaveStatus}`}
            title={module001SaveError ?? undefined}
          >
            {module001SaveStatus === "saving" ? (
              <span className="module001Spin" />
            ) : (
              <Save size={14} aria-hidden="true" />
            )}
            {module001SaveStatusLabel(module001SaveStatus, module001SaveError)}
          </span>
        </div>
        <div className="module001Toolbar">
          <button
            className="module001IconButton"
            disabled={!module001IsWriter || module001UndoStack.length === 0}
            onClick={module001Undo}
            title="撤销"
            type="button"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button
            className="module001IconButton"
            disabled={!module001IsWriter || module001RedoStack.length === 0}
            onClick={module001Redo}
            title="重做"
            type="button"
          >
            <Redo2 size={16} aria-hidden="true" />
          </button>
          <button
            className="module001SecondaryButton"
            onClick={module001HandleSaveCover}
            type="button"
          >
            <Camera size={15} aria-hidden="true" />
            设为封面
          </button>
          <button
            className="module001SecondaryButton"
            onClick={() => setModule001Dialog({ type: "xlsx" })}
            type="button"
          >
            <Download size={15} aria-hidden="true" />
            XLSX
          </button>
          <button
            className="module001SecondaryButton"
            onClick={module001HandleZipExport}
            type="button"
          >
            <FileArchive size={15} aria-hidden="true" />
            项目 ZIP
          </button>
          <button
            className="module001IconButton"
            onClick={() =>
              module001UpdateProjectUi((module001Draft) => {
                module001Draft.layout.sceneMaximized =
                  !module001Draft.layout.sceneMaximized;
              })
            }
            title={
              module001Project.layout.sceneMaximized ? "退出最大化" : "三维区最大化"
            }
            type="button"
          >
            {module001Project.layout.sceneMaximized ? (
              <Minimize2 size={16} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {!module001IsWriter ? (
        <div className="module001ReadonlyBanner" role="status">
          <span>此项目正在另一标签页中编辑，当前为只读。</span>
          <button
            className="module001SecondaryButton"
            onClick={module001RetryWriterLock}
            type="button"
          >
            <RotateCcw size={14} aria-hidden="true" />
            重试编辑权
          </button>
        </div>
      ) : null}
      {module001SaveStatus === "error" ? (
        <div className="module001SaveErrorBanner" role="alert">
          <span>{module001SaveError}</span>
          <button onClick={module001ReconnectPermission} type="button">
            重新授权
          </button>
          <button onClick={module001RetrySave} type="button">
            重试保存
          </button>
          <button onClick={module001ExportEmergencyCopy} type="button">
            导出应急副本
          </button>
        </div>
      ) : null}
      {module001Error ? (
        <div className="module001InlineError module001WorkspaceError" role="alert">
          <span>{module001Error}</span>
          <button onClick={() => setModule001Error(null)} type="button">
            关闭
          </button>
        </div>
      ) : null}

      <div className="module001WorkArea" ref={module001WorkAreaRef}>
        <div
          className="module001ScenePane"
          style={{
            width: module001LedgerHidden
              ? "100%"
              : `${100 - module001LedgerPercent}%`,
          }}
        >
          <Module001SceneCanvas
            module001OnSceneApi={(module001Api) => {
              module001SceneApiRef.current = module001Api;
            }}
          />
          {module001LedgerHidden ? (
            <button
              className="module001LedgerRestoreButton"
              onClick={() =>
                module001UpdateProjectUi((module001Draft) => {
                  module001Draft.layout.ledgerCollapsed = false;
                  module001Draft.layout.sceneMaximized = false;
                })
              }
              type="button"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              显示台账
            </button>
          ) : null}
        </div>
        {!module001LedgerHidden ? (
          <>
            <button
              aria-label="拖动调整三维区与台账比例"
              className="module001SplitHandle"
              onPointerDown={module001StartResize}
              type="button"
            />
            <div
              className="module001LedgerPane"
              style={{ width: `${module001LedgerPercent}%` }}
            >
              <button
                aria-label="折叠台账"
                className="module001LedgerCollapseButton"
                onClick={() =>
                  module001UpdateProjectUi((module001Draft) => {
                    module001Draft.layout.ledgerCollapsed = true;
                  })
                }
                title="折叠台账"
                type="button"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              <div className="module001LedgerAndDetails">
                <Module001Ledger
                  module001OnAddAsset={() => {
                    setModule001Form({
                      code: "",
                      name: "",
                      categoryId: module001Project.categories[0].categoryId,
                      nodeIds: [],
                    });
                    setModule001Dialog({ type: "add" });
                  }}
                  module001OnDeleteAsset={(module001AssetId) =>
                    setModule001Dialog({ type: "deleteAsset", assetId: module001AssetId })
                  }
                  module001OnFilteredAssetIdsChange={setModule001FilteredAssetIds}
                  module001OnManageCategories={() => setModule001CategoryOpen(true)}
                  module001OnManageFields={() => setModule001FieldOpen(true)}
                  module001OnMergeRequest={({ sourceAssetId, targetAssetId, requestedCode }) => {
                    setModule001MergeTargetId(targetAssetId);
                    setModule001MergeChoices({ code: "target" });
                    setModule001Dialog({
                      type: "merge",
                      sourceAssetId,
                      requestedCode,
                      fixedTarget: true,
                    });
                  }}
                />
                <Module001AssetDetails
                  module001OnAddNodes={(module001AssetId) => {
                    setModule001Form({ nodeIds: [] });
                    setModule001Dialog({ type: "addNodes", assetId: module001AssetId });
                  }}
                  module001OnCommit={module001CommitAssetField}
                  module001OnDelete={(module001AssetId) =>
                    setModule001Dialog({ type: "deleteAsset", assetId: module001AssetId })
                  }
                  module001OnMerge={module001OpenMerge}
                  module001OnRemoveNode={module001RemoveNode}
                  module001OnSplit={(module001AssetId) => {
                    const module001Asset = module001Project.assets.find(
                      (module001Item) => module001Item.assetId === module001AssetId,
                    );
                    setModule001Form({
                      nodeIds: [],
                      code: "",
                      name: module001Asset ? `${module001Asset.name} - 拆分` : "",
                      customValues: Object.fromEntries(
                        module001Project.customFields
                          .filter((module001Field) => module001Field.required)
                          .map((module001Field) => [
                            module001Field.fieldId,
                            module001Field.defaultValue ?? null,
                          ]),
                      ),
                    });
                    setModule001Dialog({ type: "split", assetId: module001AssetId });
                  }}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <Module001CategoryManager
        module001OnClose={() => setModule001CategoryOpen(false)}
        module001Open={module001CategoryOpen}
      />
      <Module001FieldManager
        module001OnClose={() => setModule001FieldOpen(false)}
        module001Open={module001FieldOpen}
      />

      <Module001Dialog
        module001Description="必须选择一个或多个尚未配置的顶层模型节点。"
        module001Open={module001Dialog?.type === "add"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="新增资产"
        module001Children={
          <form className="module001Form" id="module001AddAssetForm" onSubmit={module001ConfirmAddAsset}>
            <label><span>编号</span><input autoFocus required value={module001Form.code ?? ""} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, code: module001Event.target.value }))} /></label>
            <label><span>名称</span><input required value={module001Form.name ?? ""} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, name: module001Event.target.value }))} /></label>
            <label><span>类别</span><select value={module001Form.categoryId ?? ""} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, categoryId: module001Event.target.value }))}>{module001Project.categories.map((module001Category) => <option key={module001Category.categoryId} value={module001Category.categoryId}>{module001Category.name}</option>)}</select></label>
            <fieldset className="module001NodePicker"><legend>模型节点</legend>{module001AvailableNodes.map((module001Node) => <label key={module001Node.modelNodeId} className="module001CheckboxLabel"><input checked={(module001Form.nodeIds ?? []).includes(module001Node.modelNodeId)} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, nodeIds: module001Event.target.checked ? [...(module001Value.nodeIds ?? []), module001Node.modelNodeId] : (module001Value.nodeIds ?? []).filter((module001Id) => module001Id !== module001Node.modelNodeId) }))} type="checkbox" />{module001Node.displayPath}</label>)}</fieldset>
          </form>
        }
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001PrimaryButton" form="module001AddAssetForm" type="submit">新增</button></>}
      />

      <Module001Dialog
        module001Danger
        module001Description={`删除“${module001DialogAsset?.name ?? ""}”后，其固定字段和自定义值会被删除，模型节点退回未配置列表。`}
        module001Open={module001Dialog?.type === "deleteAsset"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="删除资产"
        module001Children={<div className="module001DialogMessage">该操作可在当前会话中撤销，GLB 几何不会删除。</div>}
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001DangerButton" onClick={module001ConfirmDeleteAsset} type="button">确认删除</button></>}
      />

      <Module001Dialog
        module001Description="目标资产会保留为唯一台账行；冲突字段必须逐项选择。"
        module001Open={module001Dialog?.type === "merge"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="合并资产"
        module001Children={
          <div className="module001MergeDialog">
            {!module001Dialog?.fixedTarget ? <label><span>目标资产</span><select value={module001MergeTargetId} onChange={(module001Event) => setModule001MergeTargetId(module001Event.target.value)}>{module001Project.assets.filter((module001Asset) => module001Asset.assetId !== module001Dialog?.sourceAssetId).map((module001Asset) => <option key={module001Asset.assetId} value={module001Asset.assetId}>{module001Asset.code} · {module001Asset.name}</option>)}</select></label> : null}
            {module001ConflictFields.length === 0 ? <span className="module001MutedText">没有字段冲突，节点将直接合并。</span> : module001ConflictFields.map((module001Field) => <div className="module001ConflictRow" key={module001Field.id}><strong>{module001Field.name}</strong><label><input checked={(module001MergeChoices[module001Field.id] ?? "target") === "target"} name={`merge-${module001Field.id}`} onChange={() => setModule001MergeChoices((module001Value) => ({ ...module001Value, [module001Field.id]: "target" }))} type="radio" />目标：{module001FormatConflictValue(module001Project, module001Field.id, module001Field.target)}</label><label><input checked={module001MergeChoices[module001Field.id] === "source"} name={`merge-${module001Field.id}`} onChange={() => setModule001MergeChoices((module001Value) => ({ ...module001Value, [module001Field.id]: "source" }))} type="radio" />来源：{module001FormatConflictValue(module001Project, module001Field.id, module001Field.source)}</label></div>)}
          </div>
        }
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001PrimaryButton" onClick={module001ConfirmMerge} type="button">合并为一项</button></>}
      />

      <Module001Dialog
        module001Description="选择原资产中的部分节点，并填写新的唯一编号。"
        module001Open={module001Dialog?.type === "split"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="拆分资产"
        module001Children={
          <form className="module001Form" id="module001SplitAssetForm" onSubmit={module001ConfirmSplit}>
            <label><span>新编号</span><input autoFocus required value={module001Form.code ?? ""} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, code: module001Event.target.value }))} /></label>
            <label><span>新名称</span><input required value={module001Form.name ?? ""} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, name: module001Event.target.value }))} /></label>
            <fieldset className="module001NodePicker"><legend>拆出的节点</legend>{module001DialogAsset?.modelNodeIds.map((module001NodeId) => { const module001Node = module001Project.modelNodes.find((module001Item) => module001Item.modelNodeId === module001NodeId); return <label key={module001NodeId} className="module001CheckboxLabel"><input checked={(module001Form.nodeIds ?? []).includes(module001NodeId)} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, nodeIds: module001Event.target.checked ? [...(module001Value.nodeIds ?? []), module001NodeId] : (module001Value.nodeIds ?? []).filter((module001Id) => module001Id !== module001NodeId) }))} type="checkbox" />{module001Node?.displayPath}</label>; })}</fieldset>
            {module001Project.customFields
              .filter((module001Field) => module001Field.required)
              .map((module001Field) => (
                <label key={module001Field.fieldId}>
                  <span>{module001Field.name} *</span>
                  <Module001SplitRequiredField
                    module001Field={module001Field}
                    module001Value={
                      module001Form.customValues?.[module001Field.fieldId] ?? null
                    }
                    module001OnChange={(module001NextValue) =>
                      setModule001Form((module001Value) => ({
                        ...module001Value,
                        customValues: {
                          ...(module001Value.customValues ?? {}),
                          [module001Field.fieldId]: module001NextValue,
                        },
                      }))
                    }
                  />
                </label>
              ))}
          </form>
        }
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001PrimaryButton" form="module001SplitAssetForm" type="submit">完成拆分</button></>}
      />

      <Module001Dialog
        module001Description="节点将从未配置列表转入当前资产，不能同时属于其他资产。"
        module001Open={module001Dialog?.type === "addNodes"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="添加模型节点"
        module001Children={<fieldset className="module001NodePicker"><legend>未配置对象</legend>{module001AvailableNodes.map((module001Node) => <label key={module001Node.modelNodeId} className="module001CheckboxLabel"><input checked={(module001Form.nodeIds ?? []).includes(module001Node.modelNodeId)} onChange={(module001Event) => setModule001Form((module001Value) => ({ ...module001Value, nodeIds: module001Event.target.checked ? [...(module001Value.nodeIds ?? []), module001Node.modelNodeId] : (module001Value.nodeIds ?? []).filter((module001Id) => module001Id !== module001Node.modelNodeId) }))} type="checkbox" />{module001Node.displayPath}</label>)}</fieldset>}
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001PrimaryButton" disabled={(module001Form.nodeIds ?? []).length === 0} onClick={module001ConfirmAddNodes} type="button">添加关联</button></>}
      />

      <Module001Dialog
        module001Description="网页台账当前列顺序会用于导出；筛选外临时定位行不计入筛选结果。"
        module001Open={module001Dialog?.type === "xlsx"}
        module001OnClose={() => setModule001Dialog(null)}
        module001Title="导出 XLSX 台账"
        module001Children={<div className="module001ChoiceList"><label><input checked={module001ExportScope === "all"} name="xlsxScope" onChange={() => setModule001ExportScope("all")} type="radio" />全部资产（{module001Project.assets.length}）</label><label><input checked={module001ExportScope === "filtered"} name="xlsxScope" onChange={() => setModule001ExportScope("filtered")} type="radio" />当前筛选结果（{module001FilteredAssetIds.length}）</label></div>}
        module001Footer={<><button className="module001SecondaryButton" onClick={() => setModule001Dialog(null)} type="button">取消</button><button className="module001PrimaryButton" onClick={module001ConfirmXlsxExport} type="button">选择保存位置</button></>}
      />
    </section>
  );
}
