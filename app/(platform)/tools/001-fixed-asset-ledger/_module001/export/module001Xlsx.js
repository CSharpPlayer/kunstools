import { module001SanitizeFileName } from "../domain/module001Factories";
import { module001GetAssetColor } from "../domain/module001ProjectCommands";
import { module001CreateWritable, module001WriteFile } from "../workspace/module001FileSystem";

/**
 * 把用户文本转成不会被 Excel 当作公式执行的普通文本。
 */
function module001SanitizeSpreadsheetText(module001Value) {
  const module001Text = String(module001Value ?? "");
  return /^[=+\-@]/.test(module001Text) ? `'${module001Text}` : module001Text;
}

/**
 * 把零基列序号转换成 Excel A、B、AA 形式。
 */
function module001ColumnLetter(module001Index) {
  let module001Value = module001Index + 1;
  let module001Result = "";

  while (module001Value > 0) {
    module001Value -= 1;
    module001Result =
      String.fromCharCode(65 + (module001Value % 26)) + module001Result;
    module001Value = Math.floor(module001Value / 26);
  }

  return module001Result;
}

/**
 * 生成按当前网页列顺序排列的导出列定义。
 */
function module001CreateExportColumns(module001Project) {
  const module001Definitions = new Map([
    [
      "code",
      {
        id: "code",
        header: "编号",
        type: "text",
        read: (module001Asset) => module001Asset.code,
      },
    ],
    [
      "name",
      {
        id: "name",
        header: "名称",
        type: "text",
        read: (module001Asset) => module001Asset.name,
      },
    ],
    [
      "categoryId",
      {
        id: "categoryId",
        header: "类别",
        type: "text",
        read: (module001Asset) =>
          module001Project.categories.find(
            (module001Category) =>
              module001Category.categoryId === module001Asset.categoryId,
          )?.name ?? "",
      },
    ],
    [
      "highlightColor",
      {
        id: "highlightColor",
        header: "高亮颜色",
        type: "color",
        read: (module001Asset) =>
          module001GetAssetColor(module001Project, module001Asset),
      },
    ],
  ]);

  module001Project.customFields.forEach((module001Field) => {
    module001Definitions.set(module001Field.fieldId, {
      id: module001Field.fieldId,
      header: module001Field.name,
      type: module001Field.type,
      read: (module001Asset) =>
        module001Asset.customValues[module001Field.fieldId] ?? null,
    });
  });

  return [
    ...module001Project.table.columnOrder
      .map((module001ColumnId) => module001Definitions.get(module001ColumnId))
      .filter(Boolean),
    ...[...module001Definitions.values()].filter(
      (module001Definition) =>
        !module001Project.table.columnOrder.includes(module001Definition.id),
    ),
  ];
}

/**
 * 根据字段类型生成 Excel 单元格值。
 */
function module001CreateExcelValue(module001Type, module001Value) {
  if (module001Value === null || module001Value === undefined) {
    return null;
  }

  if (module001Type === "number") {
    return Number(module001Value);
  }

  if (module001Type === "date") {
    const [module001Year, module001Month, module001Day] = String(
      module001Value,
    )
      .split("-")
      .map(Number);
    return new Date(module001Year, module001Month - 1, module001Day);
  }

  if (module001Type === "boolean") {
    return module001Value ? "是" : "否";
  }

  return module001SanitizeSpreadsheetText(module001Value);
}

/**
 * 在浏览器中生成经过类型和公式安全处理的 XLSX 字节。
 */
export async function module001BuildLedgerXlsx(
  module001Project,
  module001Assets,
) {
  const module001ExcelModule = await import("exceljs");
  const module001Excel = module001ExcelModule.default ?? module001ExcelModule;
  const module001Workbook = new module001Excel.Workbook();
  module001Workbook.creator = "鲲的工具组";
  module001Workbook.created = new Date();
  module001Workbook.modified = new Date();
  const module001Worksheet = module001Workbook.addWorksheet("固定资产台账", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const module001Columns = module001CreateExportColumns(module001Project);

  module001Worksheet.columns = module001Columns.map((module001Column) => ({
    header: module001SanitizeSpreadsheetText(module001Column.header),
    key: module001Column.id,
    width: Math.max(
      12,
      Math.min(
        36,
        Math.round(
          (module001Project.table.columnWidths[module001Column.id] ?? 140) / 7,
        ),
      ),
    ),
  }));
  const module001Header = module001Worksheet.getRow(1);
  module001Header.height = 24;
  module001Header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  module001Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  module001Header.alignment = { vertical: "middle", horizontal: "center" };

  module001Assets.forEach((module001Asset) => {
    const module001Values = {};
    module001Columns.forEach((module001Column) => {
      module001Values[module001Column.id] = module001CreateExcelValue(
        module001Column.type,
        module001Column.read(module001Asset),
      );
    });
    const module001Row = module001Worksheet.addRow(module001Values);
    module001Row.alignment = { vertical: "middle" };

    module001Columns.forEach((module001Column, module001Index) => {
      const module001Cell = module001Row.getCell(module001Index + 1);

      if (module001Column.id === "code") {
        module001Cell.numFmt = "@";
      }
      if (module001Column.type === "date" && module001Cell.value) {
        module001Cell.numFmt = "yyyy-mm-dd";
      }
      if (module001Column.type === "color") {
        const module001Hex = String(module001Cell.value ?? "")
          .replace("#", "")
          .toUpperCase();
        if (/^[0-9A-F]{6}$/.test(module001Hex)) {
          module001Cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: `FF${module001Hex}` },
          };
          module001Cell.font = { color: { argb: "FF111827" } };
        }
      }
    });
  });

  if (module001Columns.length > 0) {
    module001Worksheet.autoFilter = {
      from: "A1",
      to: `${module001ColumnLetter(module001Columns.length - 1)}${
        module001Assets.length + 1
      }`,
    };
  }

  return module001Workbook.xlsx.writeBuffer();
}

/**
 * 由用户点击动作选择独立 XLSX 保存位置。
 */
export async function module001ChooseXlsxSaveHandle(module001ProjectName) {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error("当前浏览器不支持选择 XLSX 保存位置");
  }

  return window.showSaveFilePicker({
    id: "kunstools-module001-xlsx",
    suggestedName: `${module001SanitizeFileName(module001ProjectName)}-台账.xlsx`,
    types: [
      {
        description: "Excel 工作簿",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
        },
      },
    ],
  });
}

/**
 * 刷新项目内 ledger.xlsx，并可同步写入用户选择的独立副本。
 */
export async function module001ExportLedgerXlsx({
  module001Project,
  module001ProjectDirectory,
  module001Assets,
  module001StandaloneHandle = null,
}) {
  const module001Buffer = await module001BuildLedgerXlsx(
    module001Project,
    module001Assets,
  );
  await module001WriteFile(
    module001ProjectDirectory,
    "ledger.xlsx",
    module001Buffer,
  );

  if (module001StandaloneHandle) {
    const module001Writable = await module001CreateWritable(
      module001StandaloneHandle,
    );
    try {
      await module001Writable.write(module001Buffer);
      await module001Writable.close();
    } catch (module001Error) {
      await module001Writable.abort(module001Error).catch(() => {});
      throw module001Error;
    }
  }

  return module001Buffer;
}
