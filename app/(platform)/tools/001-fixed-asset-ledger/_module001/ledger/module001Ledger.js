"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Columns3,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  module001CollectProjectErrors,
  module001GetAssetColor,
} from "../domain/module001ProjectCommands";
import { module001UseStore } from "../state/module001Store";
import Module001EditableCell from "./module001EditableCell";

const module001FixedColumns = ["code", "name", "categoryId", "highlightColor"];

/**
 * 读取固定字段或自定义字段的当前资产值。
 */
function module001GetAssetFieldValue(
  module001Project,
  module001Asset,
  module001FieldId,
) {
  if (module001FieldId === "highlightColor") {
    return module001GetAssetColor(module001Project, module001Asset);
  }

  if (module001FixedColumns.includes(module001FieldId)) {
    return module001Asset[module001FieldId];
  }

  return module001Asset.customValues[module001FieldId] ?? null;
}

/**
 * 生成网页台账使用的固定列和项目自定义列定义。
 */
function module001BuildColumns({
  module001Project,
  module001Disabled,
  module001ErrorMap,
  module001OnCommit,
}) {
  const module001CategoryOptions = module001Project.categories.map(
    (module001Category) => ({
      value: module001Category.categoryId,
      label: module001Category.name,
    }),
  );
  const module001CreateCell =
    (module001FieldId, module001Type, module001Options = []) =>
    /** 渲染一列共用的编辑单元格。 */
    function Module001Cell(module001Context) {
      const module001Asset = module001Context.row.original;
      return (
        <Module001EditableCell
          key={
            module001Type === "color"
              ? `${module001Asset.assetId}:${module001FieldId}`
              : `${module001Asset.assetId}:${module001FieldId}:${String(
                  module001GetAssetFieldValue(
                    module001Project,
                    module001Asset,
                    module001FieldId,
                  ),
                )}`
          }
          module001Asset={module001Asset}
          module001ColorPickerId={`ledger:${module001Asset.assetId}:${module001FieldId}`}
          module001Disabled={module001Disabled}
          module001Error={module001ErrorMap.get(
            `${module001Asset.assetId}:${module001FieldId}`,
          )}
          module001FieldId={module001FieldId}
          module001OnCommit={module001OnCommit}
          module001Options={module001Options}
          module001Type={module001Type}
          module001Value={module001GetAssetFieldValue(
            module001Project,
            module001Asset,
            module001FieldId,
          )}
        />
      );
    };

  return [
    {
      accessorKey: "code",
      id: "code",
      header: "编号",
      size: module001Project.table.columnWidths.code ?? 130,
      minSize: 90,
      cell: module001CreateCell("code", "text"),
    },
    {
      accessorKey: "name",
      id: "name",
      header: "名称",
      size: module001Project.table.columnWidths.name ?? 180,
      minSize: 110,
      cell: module001CreateCell("name", "text"),
    },
    {
      accessorFn: (module001Asset) =>
        module001Project.categories.find(
          (module001Category) =>
            module001Category.categoryId === module001Asset.categoryId,
        )?.name ?? "",
      id: "categoryId",
      header: "类别",
      size: module001Project.table.columnWidths.categoryId ?? 130,
      minSize: 100,
      cell: module001CreateCell(
        "categoryId",
        "select",
        module001CategoryOptions,
      ),
      filterFn: "includesString",
    },
    {
      accessorFn: (module001Asset) =>
        module001GetAssetColor(module001Project, module001Asset),
      id: "highlightColor",
      header: "高亮颜色",
      size: module001Project.table.columnWidths.highlightColor ?? 120,
      minSize: 105,
      cell: module001CreateCell("highlightColor", "color"),
    },
    ...module001Project.customFields.map((module001Field) => ({
      accessorFn: (module001Asset) =>
        module001Asset.customValues[module001Field.fieldId] ?? null,
      id: module001Field.fieldId,
      header: module001Field.name,
      size: module001Project.table.columnWidths[module001Field.fieldId] ?? 140,
      minSize: 90,
      cell: module001CreateCell(
        module001Field.fieldId,
        module001Field.type,
        module001Field.type === "select"
          ? module001Field.options.map((module001Option) => ({
              value: module001Option,
              label: module001Option,
            }))
          : [],
      ),
    })),
  ];
}

/**
 * 计算透明资产色背景，保持深色高亮色下的文字可读性。
 */
function module001CreateRowStyle(module001Color) {
  return {
    "--module001RowHighlight": `${module001Color}18`,
    "--module001RowAccent": module001Color,
  };
}

/**
 * 渲染单个虚拟台账行，并连接悬停与持续选择状态。
 */
function Module001LedgerRow({
  module001Row,
  module001Project,
  module001Selected,
  module001Pinned = false,
  module001TotalWidth,
  module001OnHover,
  module001OnSelect,
  module001Style,
}) {
  const module001Asset = module001Row.original;
  const module001Color = module001GetAssetColor(
    module001Project,
    module001Asset,
  );

  return (
    <div
      className={`module001LedgerRow ${
        module001Selected ? "module001LedgerRowSelected" : ""
      } ${module001Pinned ? "module001LedgerRowPinned" : ""}`}
      data-asset-id={module001Asset.assetId}
      onClick={() => module001OnSelect(module001Asset.assetId)}
      onMouseEnter={() => module001OnHover(module001Asset.assetId)}
      onMouseLeave={() => module001OnHover(null)}
      role="row"
      style={{
        ...module001CreateRowStyle(module001Color),
        ...module001Style,
        width: module001TotalWidth,
      }}
      tabIndex={0}
      onKeyDown={(module001Event) => {
        if (module001Event.key === "Enter" || module001Event.key === " ") {
          module001Event.preventDefault();
          module001OnSelect(module001Asset.assetId);
        }
      }}
    >
      {module001Row.getVisibleCells().map((module001Cell) => (
        <div
          className="module001LedgerCell"
          key={module001Cell.id}
          onClick={(module001Event) => module001Event.stopPropagation()}
          role="cell"
          style={{ width: module001Cell.column.getSize() }}
        >
          {flexRender(
            module001Cell.column.columnDef.cell,
            module001Cell.getContext(),
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 渲染支持编辑、查询、排序、筛选、列宽和虚拟滚动的网页台账。
 */
export default function Module001Ledger({
  module001OnAddAsset,
  module001OnDeleteAsset,
  module001OnManageCategories,
  module001OnManageFields,
  module001OnMergeRequest,
  module001OnFilteredAssetIdsChange,
}) {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const module001HoverAssetId = module001UseStore(
    (module001State) => module001State.hoverAssetId,
  );
  const module001SelectedAssetId = module001UseStore(
    (module001State) => module001State.selectedAssetId,
  );
  const module001SetHoverAssetId = module001UseStore(
    (module001State) => module001State.setHoverAssetId,
  );
  const module001SetSelectedAssetId = module001UseStore(
    (module001State) => module001State.setSelectedAssetId,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001UpdateProjectUi = module001UseStore(
    (module001State) => module001State.updateProjectUi,
  );
  const module001ScrollRef = useRef(null);
  const module001Errors = useMemo(
    () => module001CollectProjectErrors(module001Project),
    [module001Project],
  );
  const module001ErrorMap = useMemo(
    () =>
      new Map(
        module001Errors.map((module001Error) => [
          `${module001Error.assetId}:${module001Error.fieldId}`,
          module001Error.message,
        ]),
      ),
    [module001Errors],
  );

  /** 提交单元格编辑；编号碰撞时转交显式合并流程。 */
  const module001CommitCell = useCallback((
    module001AssetId,
    module001FieldId,
    module001Value,
  ) => {
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
        module001OnMergeRequest({
          sourceAssetId: module001AssetId,
          targetAssetId: module001Existing.assetId,
          requestedCode: module001Value,
        });
        return;
      }
    }

    module001RunProjectCommand("编辑台账单元格", (module001Draft) => {
      const module001DraftAsset = module001Draft.assets.find(
        (module001Item) => module001Item.assetId === module001AssetId,
      );

      if (!module001DraftAsset) {
        return;
      }

      if (module001FieldId === "highlightColor") {
        const module001CategoryColor = module001Draft.categories.find(
          (module001Category) =>
            module001Category.categoryId === module001DraftAsset.categoryId,
        )?.defaultColor;
        module001DraftAsset.highlightColorOverride =
          module001CategoryColor?.toLowerCase() ===
          String(module001Value).toLowerCase()
            ? null
            : module001Value;
      } else if (module001FixedColumns.includes(module001FieldId)) {
        module001DraftAsset[module001FieldId] = module001Value;
      } else {
        module001DraftAsset.customValues[module001FieldId] = module001Value;
      }
    });
  }, [
    module001OnMergeRequest,
    module001Project,
    module001RunProjectCommand,
  ]);

  const module001Columns = useMemo(
    () =>
      module001BuildColumns({
        module001Project,
        module001Disabled: !module001IsWriter,
        module001ErrorMap,
        module001OnCommit: module001CommitCell,
      }),
    [
      module001CommitCell,
      module001ErrorMap,
      module001IsWriter,
      module001Project,
    ],
  );
  const module001ValidColumnIds = module001Columns.map(
    (module001Column) => module001Column.id,
  );
  const module001ColumnOrder = [
    ...module001Project.table.columnOrder.filter((module001ColumnId) =>
      module001ValidColumnIds.includes(module001ColumnId),
    ),
    ...module001ValidColumnIds.filter(
      (module001ColumnId) =>
        !module001Project.table.columnOrder.includes(module001ColumnId),
    ),
  ];

  // TanStack Table 返回可变表实例，React Compiler 按官方规则跳过本组件即可。
  // eslint-disable-next-line react-hooks/incompatible-library
  const module001Table = useReactTable({
    data: module001Project.assets,
    columns: module001Columns,
    getRowId: (module001Asset) => module001Asset.assetId,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onEnd",
    state: {
      sorting: module001Project.table.sorting,
      columnFilters: module001Project.table.columnFilters,
      globalFilter: module001Project.table.globalFilter,
      columnOrder: module001ColumnOrder,
      columnSizing: module001Project.table.columnWidths,
    },
    onSortingChange: (module001Updater) =>
      module001UpdateProjectUi((module001Draft) => {
        module001Draft.table.sorting =
          typeof module001Updater === "function"
            ? module001Updater(module001Draft.table.sorting)
            : module001Updater;
      }),
    onColumnFiltersChange: (module001Updater) =>
      module001UpdateProjectUi((module001Draft) => {
        module001Draft.table.columnFilters =
          typeof module001Updater === "function"
            ? module001Updater(module001Draft.table.columnFilters)
            : module001Updater;
      }),
    onGlobalFilterChange: (module001Value) =>
      module001UpdateProjectUi((module001Draft) => {
        module001Draft.table.globalFilter = module001Value;
      }),
    onColumnSizingChange: (module001Updater) =>
      module001UpdateProjectUi((module001Draft) => {
        module001Draft.table.columnWidths =
          typeof module001Updater === "function"
            ? module001Updater(module001Draft.table.columnWidths)
            : module001Updater;
      }),
  });
  const module001Rows = module001Table.getRowModel().rows;
  const module001FilteredAssetIdSignature = module001Rows
    .map((module001Row) => module001Row.original.assetId)
    .join("\u001f");
  const module001Virtualizer = useVirtualizer({
    count: module001Rows.length,
    getScrollElement: () => module001ScrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });
  const module001VisibleHoverRow = module001Rows.find(
    (module001Row) => module001Row.original.assetId === module001HoverAssetId,
  );
  const module001PinnedAsset =
    module001HoverAssetId && !module001VisibleHoverRow
      ? module001Project.assets.find(
          (module001Asset) =>
            module001Asset.assetId === module001HoverAssetId,
        )
      : null;
  const module001PinnedRow = module001PinnedAsset
    ? module001Table.getCoreRowModel().rows.find(
        (module001Row) =>
          module001Row.original.assetId === module001PinnedAsset.assetId,
      )
    : null;

  useEffect(() => {
    module001OnFilteredAssetIdsChange?.(
      module001FilteredAssetIdSignature
        ? module001FilteredAssetIdSignature.split("\u001f")
        : [],
    );
  }, [module001FilteredAssetIdSignature, module001OnFilteredAssetIdsChange]);

  useEffect(() => {
    if (!module001HoverAssetId) {
      return;
    }

    const module001Index = module001Rows.findIndex(
      (module001Row) =>
        module001Row.original.assetId === module001HoverAssetId,
    );

    if (module001Index >= 0) {
      module001Virtualizer.scrollToIndex(module001Index, { align: "auto" });
    }
  }, [module001HoverAssetId, module001Rows, module001Virtualizer]);

  /** 将指定列向左或向右移动并持久化。 */
  function module001MoveColumn(module001ColumnId, module001Direction) {
    module001UpdateProjectUi((module001Draft) => {
      const module001Order = [...module001ColumnOrder];
      const module001Index = module001Order.indexOf(module001ColumnId);
      const module001TargetIndex = module001Index + module001Direction;

      if (
        module001Index < 0 ||
        module001TargetIndex < 0 ||
        module001TargetIndex >= module001Order.length
      ) {
        return;
      }

      [module001Order[module001Index], module001Order[module001TargetIndex]] = [
        module001Order[module001TargetIndex],
        module001Order[module001Index],
      ];
      module001Draft.table.columnOrder = module001Order;
    });
  }

  return (
    <section className="module001LedgerPanel" aria-label="资产台账">
      <div className="module001LedgerToolbar">
        <label className="module001SearchBox">
          <Search size={15} aria-hidden="true" />
          <input
            aria-label="全局搜索"
            onChange={(module001Event) =>
              module001Table.setGlobalFilter(module001Event.target.value)
            }
            placeholder="搜索全部字段"
            value={module001Project.table.globalFilter}
          />
        </label>
        <span className="module001LedgerCount">
          {module001Rows.length} / {module001Project.assets.length}
        </span>
        <button
          className="module001SecondaryButton"
          onClick={module001OnManageCategories}
          type="button"
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          类别
        </button>
        <button
          className="module001SecondaryButton"
          onClick={module001OnManageFields}
          type="button"
        >
          <Columns3 size={15} aria-hidden="true" />
          字段
        </button>
        <button
          className="module001IconButton"
          disabled={!module001IsWriter}
          onClick={module001OnAddAsset}
          title="新增资产"
          type="button"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          className="module001IconButton"
          disabled={!module001SelectedAssetId || !module001IsWriter}
          onClick={() => module001OnDeleteAsset(module001SelectedAssetId)}
          title="删除选中资产"
          type="button"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {module001Errors.length > 0 ? (
        <button
          className="module001ValidationSummary"
          onClick={() => {
            const module001FirstError = module001Errors[0];
            module001SetSelectedAssetId(module001FirstError.assetId);
          }}
          type="button"
        >
          {module001Errors.length} 个校验问题，点击定位第一项
        </button>
      ) : null}

      <div className="module001LedgerHeader" role="row" style={{ width: module001Table.getTotalSize() }}>
        {module001Table.getHeaderGroups()[0].headers.map((module001Header) => {
          const module001Sorting = module001Header.column.getIsSorted();
          const module001FilterValue =
            module001Header.column.getFilterValue() ?? "";
          return (
            <div
              className="module001LedgerHeaderCell"
              key={module001Header.id}
              role="columnheader"
              style={{ width: module001Header.getSize() }}
            >
              <div className="module001LedgerHeaderLabel">
                <button
                  onClick={module001Header.column.getToggleSortingHandler()}
                  type="button"
                >
                  {flexRender(
                    module001Header.column.columnDef.header,
                    module001Header.getContext(),
                  )}
                  {module001Sorting === "asc" ? (
                    <ChevronUp size={13} aria-hidden="true" />
                  ) : module001Sorting === "desc" ? (
                    <ChevronDown size={13} aria-hidden="true" />
                  ) : null}
                </button>
                <span className="module001ColumnMoveButtons">
                  <button
                    aria-label="列向左移动"
                    onClick={() => module001MoveColumn(module001Header.id, -1)}
                    type="button"
                  >
                    <ArrowLeft size={11} aria-hidden="true" />
                  </button>
                  <button
                    aria-label="列向右移动"
                    onClick={() => module001MoveColumn(module001Header.id, 1)}
                    type="button"
                  >
                    <ArrowRight size={11} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <input
                aria-label={`筛选 ${String(module001Header.column.columnDef.header)}`}
                onChange={(module001Event) =>
                  module001Header.column.setFilterValue(module001Event.target.value)
                }
                placeholder="筛选"
                value={module001FilterValue}
              />
              <button
                aria-label="调整列宽"
                className="module001ColumnResizer"
                onDoubleClick={() => module001Header.column.resetSize()}
                onMouseDown={module001Header.getResizeHandler()}
                onTouchStart={module001Header.getResizeHandler()}
                type="button"
              />
            </div>
          );
        })}
      </div>

      {module001PinnedRow ? (
        <div className="module001PinnedRowWrap">
          <span>筛选外定位</span>
          <Module001LedgerRow
            module001OnHover={module001SetHoverAssetId}
            module001OnSelect={module001SetSelectedAssetId}
            module001Pinned
            module001Project={module001Project}
            module001Row={module001PinnedRow}
            module001Selected={
              module001PinnedRow.original.assetId === module001SelectedAssetId
            }
            module001TotalWidth={module001Table.getTotalSize()}
          />
        </div>
      ) : null}

      <div className="module001LedgerScroll" ref={module001ScrollRef} role="rowgroup">
        <div
          className="module001LedgerVirtualBody"
          style={{
            height: module001Virtualizer.getTotalSize(),
            width: module001Table.getTotalSize(),
          }}
        >
          {module001Virtualizer.getVirtualItems().map((module001VirtualRow) => {
            const module001Row = module001Rows[module001VirtualRow.index];
            return (
              <Module001LedgerRow
                key={module001Row.id}
                module001OnHover={module001SetHoverAssetId}
                module001OnSelect={module001SetSelectedAssetId}
                module001Project={module001Project}
                module001Row={module001Row}
                module001Selected={
                  module001Row.original.assetId === module001SelectedAssetId
                }
                module001Style={{
                  height: module001VirtualRow.size,
                  transform: `translateY(${module001VirtualRow.start}px)`,
                }}
                module001TotalWidth={module001Table.getTotalSize()}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
