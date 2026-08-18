import { module001CreateAsset, module001CreateId } from "./module001Factories";
import { module001ValidateCustomValue } from "./module001Schemas";

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
 * 返回资产当前生效的高亮色。
 */
export function module001GetAssetColor(module001Project, module001Asset) {
  if (module001Asset.highlightColorOverride) {
    return module001Asset.highlightColorOverride;
  }

  return (
    module001Project.categories.find(
      (module001Category) =>
        module001Category.categoryId === module001Asset.categoryId,
    )?.defaultColor ?? "#2563eb"
  );
}

/**
 * 检查项目当前业务状态，并返回可定位的中文错误列表。
 */
export function module001CollectProjectErrors(module001Project) {
  const module001Errors = [];
  const module001SeenCodes = new Map();

  module001Project.assets.forEach((module001Asset) => {
    const module001Code = module001Asset.code.trim();

    if (!module001Code) {
      module001Errors.push({
        assetId: module001Asset.assetId,
        fieldId: "code",
        message: "编号不能为空",
      });
    } else if (module001SeenCodes.has(module001Code)) {
      module001Errors.push({
        assetId: module001Asset.assetId,
        fieldId: "code",
        message: "编号与另一项资产重复，必须先合并",
      });
    } else {
      module001SeenCodes.set(module001Code, module001Asset.assetId);
    }

    if (!module001Asset.name.trim()) {
      module001Errors.push({
        assetId: module001Asset.assetId,
        fieldId: "name",
        message: "名称不能为空",
      });
    }

    if (
      !module001Project.categories.some(
        (module001Category) =>
          module001Category.categoryId === module001Asset.categoryId,
      )
    ) {
      module001Errors.push({
        assetId: module001Asset.assetId,
        fieldId: "categoryId",
        message: "请选择有效类别",
      });
    }

    module001Project.customFields.forEach((module001Field) => {
      const module001Message = module001ValidateCustomValue(
        module001Field,
        module001Asset.customValues[module001Field.fieldId] ?? null,
      );

      if (module001Message) {
        module001Errors.push({
          assetId: module001Asset.assetId,
          fieldId: module001Field.fieldId,
          message: module001Message,
        });
      }
    });
  });

  return module001Errors;
}

/**
 * 将初始化表格转换为一项逻辑资产一行的数据，并合并相同编号节点。
 */
export function module001CompleteInitialization(
  module001Project,
  module001Rows,
) {
  const module001SelectedRows = module001Rows.filter(
    (module001Row) => module001Row.selected,
  );

  if (module001SelectedRows.length === 0) {
    throw new Error("至少选择一个资产对象");
  }

  const module001Groups = new Map();

  for (const module001Row of module001SelectedRows) {
    const module001Code = module001Row.code.trim();

    if (!module001Code || !module001Row.name.trim() || !module001Row.categoryId) {
      throw new Error("编号、名称、类别和高亮颜色全部必填");
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(module001Row.color)) {
      throw new Error("存在无效的高亮颜色");
    }

    const module001Existing = module001Groups.get(module001Code);

    if (module001Existing) {
      if (
        module001Existing.name.trim() !== module001Row.name.trim() ||
        module001Existing.categoryId !== module001Row.categoryId ||
        module001Existing.color.toLowerCase() !== module001Row.color.toLowerCase()
      ) {
        throw new Error(
          `编号 ${module001Code} 的多个节点存在名称、类别或颜色冲突，请先统一`,
        );
      }

      module001Existing.modelNodeIds.push(module001Row.modelNodeId);
    } else {
      module001Groups.set(module001Code, {
        code: module001Row.code,
        name: module001Row.name,
        categoryId: module001Row.categoryId,
        color: module001Row.color,
        modelNodeIds: [module001Row.modelNodeId],
      });
    }
  }

  const module001Assets = [...module001Groups.values()].map(
    (module001Group) => {
      const module001Defaults = Object.fromEntries(
        module001Project.customFields.map((module001Field) => [
          module001Field.fieldId,
          module001Field.defaultValue ?? null,
        ]),
      );
      const module001Asset = module001CreateAsset({
        module001Code: module001Group.code,
        module001Name: module001Group.name,
        module001CategoryId: module001Group.categoryId,
        module001ModelNodeIds: module001Group.modelNodeIds,
        module001CustomValues: module001Defaults,
      });
      const module001CategoryColor = module001Project.categories.find(
        (module001Category) =>
          module001Category.categoryId === module001Group.categoryId,
      )?.defaultColor;

      if (
        module001CategoryColor?.toLowerCase() !==
        module001Group.color.toLowerCase()
      ) {
        module001Asset.highlightColorOverride = module001Group.color;
      }

      return module001Asset;
    },
  );
  const module001AssetByNodeId = new Map();

  module001Assets.forEach((module001Asset) => {
    module001Asset.modelNodeIds.forEach((module001NodeId) => {
      module001AssetByNodeId.set(module001NodeId, module001Asset.assetId);
    });
  });

  module001Project.assets = module001Assets;
  module001Project.modelNodes = module001Project.modelNodes.map(
    (module001Node) => {
      const module001AssetId = module001AssetByNodeId.get(
        module001Node.modelNodeId,
      );
      return {
        ...module001Node,
        isAssetObject: Boolean(module001AssetId),
        assetId: module001AssetId ?? null,
      };
    },
  );
  module001Project.initializationStatus = "ready";

  const module001Errors = module001CollectProjectErrors(module001Project);

  if (module001Errors.length > 0) {
    throw new Error(module001Errors[0].message);
  }
}

/**
 * 删除资产并把其所有模型节点退回未配置对象列表。
 */
export function module001DeleteAsset(module001Project, module001AssetId) {
  const module001Asset = module001Project.assets.find(
    (module001Item) => module001Item.assetId === module001AssetId,
  );

  if (!module001Asset) {
    throw new Error("找不到要删除的资产");
  }

  const module001ReleasedNodeIds = new Set(module001Asset.modelNodeIds);
  module001Project.assets = module001Project.assets.filter(
    (module001Item) => module001Item.assetId !== module001AssetId,
  );
  module001Project.modelNodes = module001Project.modelNodes.map(
    (module001Node) =>
      module001ReleasedNodeIds.has(module001Node.modelNodeId)
        ? { ...module001Node, isAssetObject: false, assetId: null }
        : module001Node,
  );
}

/**
 * 使用尚未配置的顶层节点新增一项资产。
 */
export function module001AddAsset(
  module001Project,
  {
    module001Code,
    module001Name,
    module001CategoryId,
    module001ModelNodeIds,
  },
) {
  if (
    module001Project.assets.some(
      (module001Asset) =>
        module001Asset.code.trim() === module001Code.trim(),
    )
  ) {
    throw new Error("该编号已经存在，请改用合并资产");
  }

  const module001AvailableNodeIds = new Set(
    module001Project.modelNodes
      .filter(
        (module001Node) => module001Node.isCandidate && !module001Node.assetId,
      )
      .map((module001Node) => module001Node.modelNodeId),
  );

  if (
    module001ModelNodeIds.length === 0 ||
    module001ModelNodeIds.some(
      (module001NodeId) => !module001AvailableNodeIds.has(module001NodeId),
    )
  ) {
    throw new Error("新增资产必须选择一个或多个尚未配置的模型节点");
  }

  const module001CustomValues = Object.fromEntries(
    module001Project.customFields.map((module001Field) => [
      module001Field.fieldId,
      module001Field.defaultValue ?? null,
    ]),
  );
  const module001Asset = module001CreateAsset({
    module001Code,
    module001Name,
    module001CategoryId,
    module001ModelNodeIds,
    module001CustomValues,
  });

  module001Project.assets.push(module001Asset);
  module001Project.modelNodes = module001Project.modelNodes.map(
    (module001Node) =>
      module001ModelNodeIds.includes(module001Node.modelNodeId)
        ? {
            ...module001Node,
            isAssetObject: true,
            assetId: module001Asset.assetId,
          }
        : module001Node,
  );
  return module001Asset;
}

/**
 * 合并两项资产，并按已经确认的字段值解决冲突。
 */
export function module001MergeAssets(
  module001Project,
  module001TargetAssetId,
  module001SourceAssetId,
  module001ResolvedValues,
) {
  const module001Target = module001Project.assets.find(
    (module001Asset) => module001Asset.assetId === module001TargetAssetId,
  );
  const module001Source = module001Project.assets.find(
    (module001Asset) => module001Asset.assetId === module001SourceAssetId,
  );

  if (!module001Target || !module001Source || module001Target === module001Source) {
    throw new Error("请选择两项不同的有效资产进行合并");
  }

  Object.assign(module001Target, {
    code: module001ResolvedValues.code ?? module001Target.code,
    name: module001ResolvedValues.name ?? module001Target.name,
    categoryId:
      module001ResolvedValues.categoryId ?? module001Target.categoryId,
    highlightColorOverride: Object.prototype.hasOwnProperty.call(
      module001ResolvedValues,
      "highlightColorOverride",
    )
      ? module001ResolvedValues.highlightColorOverride
      : module001Target.highlightColorOverride,
    customValues: {
      ...module001Source.customValues,
      ...module001Target.customValues,
      ...(module001ResolvedValues.customValues ?? {}),
    },
    modelNodeIds: [
      ...new Set([
        ...module001Target.modelNodeIds,
        ...module001Source.modelNodeIds,
      ]),
    ],
  });
  module001Project.assets = module001Project.assets.filter(
    (module001Asset) => module001Asset.assetId !== module001SourceAssetId,
  );
  module001Project.modelNodes = module001Project.modelNodes.map(
    (module001Node) =>
      module001Node.assetId === module001SourceAssetId
        ? { ...module001Node, assetId: module001TargetAssetId }
        : module001Node,
  );
}

/**
 * 从一项多节点资产中拆出一项新的逻辑资产。
 */
export function module001SplitAsset(
  module001Project,
  module001SourceAssetId,
  {
    module001NodeIds,
    module001Code,
    module001Name,
    module001CustomValues,
  },
) {
  const module001Source = module001Project.assets.find(
    (module001Asset) => module001Asset.assetId === module001SourceAssetId,
  );

  if (!module001Source || module001Source.modelNodeIds.length < 2) {
    throw new Error("只有关联多个节点的资产才能拆分");
  }

  if (
    module001NodeIds.length === 0 ||
    module001NodeIds.length >= module001Source.modelNodeIds.length ||
    module001NodeIds.some(
      (module001NodeId) => !module001Source.modelNodeIds.includes(module001NodeId),
    )
  ) {
    throw new Error("请选择原资产中的部分节点进行拆分");
  }

  if (
    !module001Code.trim() ||
    module001Project.assets.some(
      (module001Asset) =>
        module001Asset.code.trim() === module001Code.trim(),
    )
  ) {
    throw new Error("拆分后的新编号必须填写且保持唯一");
  }

  const module001NextCustomValues = Object.fromEntries(
    module001Project.customFields.map((module001Field) => {
      const module001Value =
        module001CustomValues?.[module001Field.fieldId] ??
        module001Field.defaultValue ??
        null;
      const module001Error = module001ValidateCustomValue(
        module001Field,
        module001Value,
      );

      if (module001Error) {
        throw new Error(`${module001Field.name}：${module001Error}`);
      }

      return [module001Field.fieldId, module001Value];
    }),
  );
  const module001NewAsset = module001CreateAsset({
    module001Code,
    module001Name,
    module001CategoryId: module001Source.categoryId,
    module001ModelNodeIds: module001NodeIds,
    module001CustomValues: module001NextCustomValues,
  });
  module001NewAsset.highlightColorOverride =
    module001Source.highlightColorOverride;
  module001Source.modelNodeIds = module001Source.modelNodeIds.filter(
    (module001NodeId) => !module001NodeIds.includes(module001NodeId),
  );
  module001Project.assets.push(module001NewAsset);
  module001Project.modelNodes = module001Project.modelNodes.map(
    (module001Node) =>
      module001NodeIds.includes(module001Node.modelNodeId)
        ? { ...module001Node, assetId: module001NewAsset.assetId }
        : module001Node,
  );
  return module001NewAsset;
}

/**
 * 新增一个自定义字段，并为全部现有资产填入合法默认值。
 */
export function module001AddCustomField(
  module001Project,
  module001Definition,
) {
  const module001Name = module001Definition.name.trim();
  const module001Options = (module001Definition.options ?? [])
    .map((module001Option) => module001Option.trim())
    .filter(Boolean);

  if (
    !module001Name ||
    module001FixedFieldNames.has(module001Name) ||
    module001Project.customFields.some(
      (module001Field) => module001Field.name === module001Name,
    )
  ) {
    throw new Error("字段名为空、重复或与固定字段冲突");
  }

  if (
    module001Definition.type === "select" &&
    (module001Options.length === 0 ||
      new Set(module001Options).size !== module001Options.length)
  ) {
    throw new Error("单选字段必须提供不重复的有效选项");
  }

  const module001Field = {
    fieldId: module001CreateId(),
    name: module001Name,
    type: module001Definition.type,
    required: Boolean(module001Definition.required),
    defaultValue: module001Definition.defaultValue ?? null,
    options:
      module001Definition.type === "select" ? module001Options : [],
    order: module001Project.customFields.length,
  };
  const module001DefaultError = module001ValidateCustomValue(
    module001Field,
    module001Field.defaultValue,
  );

  if (module001Project.assets.length > 0 && module001DefaultError) {
    throw new Error("新增必填字段时必须提供可覆盖现有资产的默认值");
  }

  module001Project.customFields.push(module001Field);
  module001Project.table.columnOrder.push(module001Field.fieldId);
  module001Project.table.columnWidths[module001Field.fieldId] = 140;
  module001Project.assets.forEach((module001Asset) => {
    module001Asset.customValues[module001Field.fieldId] =
      module001Field.defaultValue;
  });
  return module001Field;
}

/**
 * 删除自定义字段及全部资产中对应的值。
 */
export function module001DeleteCustomField(
  module001Project,
  module001FieldId,
) {
  module001Project.customFields = module001Project.customFields.filter(
    (module001Field) => module001Field.fieldId !== module001FieldId,
  );
  module001Project.table.columnOrder =
    module001Project.table.columnOrder.filter(
      (module001ColumnId) => module001ColumnId !== module001FieldId,
    );
  delete module001Project.table.columnWidths[module001FieldId];
  module001Project.assets.forEach((module001Asset) => {
    delete module001Asset.customValues[module001FieldId];
  });
}
