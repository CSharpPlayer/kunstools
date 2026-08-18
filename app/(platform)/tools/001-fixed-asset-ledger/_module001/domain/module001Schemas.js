import { z } from "zod";

export const module001ProjectFormatVersion = 1;
export const module001WorkspaceFormatVersion = 1;
export const module001PackageFormatVersion = 1;

const module001IsoDateTimeSchema = z.string().min(1);
const module001ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const module001DateValueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const module001CustomValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
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

export const module001CategorySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1),
  defaultColor: module001ColorSchema,
});

export const module001CustomFieldSchema = z.object({
  fieldId: z.string().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["text", "number", "date", "select", "boolean"]),
  required: z.boolean(),
  defaultValue: module001CustomValueSchema.optional().nullable(),
  options: z.array(z.string().trim().min(1)).default([]),
  order: z.number().int().nonnegative(),
});

export const module001ModelNodeSchema = z.object({
  modelNodeId: z.string().min(1),
  sourceName: z.string(),
  displayPath: z.string().min(1),
  topLevelIndex: z.number().int().nonnegative(),
  sceneNodeOrdinal: z.number().int().nonnegative(),
  meshDescendantCount: z.number().int().nonnegative(),
  isCandidate: z.boolean(),
  isAssetObject: z.boolean(),
  visible: z.boolean(),
  assetId: z.string().min(1).nullable(),
});

export const module001AssetSchema = z.object({
  assetId: z.string().min(1),
  code: z.string(),
  name: z.string(),
  categoryId: z.string().min(1),
  highlightColorOverride: module001ColorSchema.nullable(),
  modelNodeIds: z.array(z.string().min(1)).min(1),
  customValues: z.record(z.string(), module001CustomValueSchema),
});

const module001TableSettingsSchema = z.object({
  columnOrder: z.array(z.string()),
  columnWidths: z.record(z.string(), z.number().min(64).max(640)),
  sorting: z.array(
    z.object({
      id: z.string(),
      desc: z.boolean(),
    }),
  ),
  columnFilters: z.array(
    z.object({
      id: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ),
  globalFilter: z.string(),
});

const module001CameraSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
});

export const module001ProjectSchema = z
  .object({
    projectFormatVersion: z.literal(module001ProjectFormatVersion),
    revision: z.number().int().nonnegative(),
    projectId: z.string().min(1),
    displayName: z.string().trim().min(1),
    createdAt: module001IsoDateTimeSchema,
    updatedAt: module001IsoDateTimeSchema,
    initializationStatus: z.enum(["draft", "ready"]),
    model: z.object({
      fileName: z.string().min(1),
      fileSize: z.number().int().nonnegative().max(500 * 1024 * 1024),
      importedAt: module001IsoDateTimeSchema,
      sceneCount: z.number().int().positive(),
      topLevelNodeCount: z.number().int().nonnegative(),
      candidateNodeCount: z.number().int().nonnegative(),
      extensionsUsed: z.array(z.string()),
      extensionsRequired: z.array(z.string()),
    }),
    categories: z.array(module001CategorySchema).min(1),
    customFields: z.array(module001CustomFieldSchema),
    assets: z.array(module001AssetSchema),
    modelNodes: z.array(module001ModelNodeSchema),
    sceneSettings: z.object({
      showSceneObjects: z.boolean(),
      showLabels: z.boolean(),
    }),
    camera: module001CameraSchema,
    coverCamera: module001CameraSchema.nullable(),
    table: module001TableSettingsSchema,
    layout: z.object({
      ledgerPercent: z.number().min(24).max(70),
      ledgerCollapsed: z.boolean(),
      sceneMaximized: z.boolean(),
      detailsExpanded: z.boolean(),
    }),
  })
  .superRefine((module001Project, module001Context) => {
    const module001CategoryIds = new Set();
    const module001CategoryNames = new Set();
    const module001FieldIds = new Set();
    const module001FieldNames = new Set();
    const module001FieldOrders = new Set();
    const module001AssetIds = new Set();
    const module001Codes = new Set();
    const module001NodeOwnerIds = new Map();
    const module001NodeIds = new Set(
      module001Project.modelNodes.map((module001Node) => module001Node.modelNodeId),
    );
    const module001SeenModelNodeIds = new Set();
    const module001SceneNodeOrdinals = new Set();

    if (
      module001Project.model.topLevelNodeCount !==
      module001Project.modelNodes.length
    ) {
      module001Context.addIssue({
        code: "custom",
        message: "模型顶层节点数量与节点目录不一致",
        path: ["model", "topLevelNodeCount"],
      });
    }
    if (
      module001Project.model.candidateNodeCount !==
      module001Project.modelNodes.filter(
        (module001Node) => module001Node.isCandidate,
      ).length
    ) {
      module001Context.addIssue({
        code: "custom",
        message: "模型候选节点数量与节点目录不一致",
        path: ["model", "candidateNodeCount"],
      });
    }

    module001Project.categories.forEach((module001Category, module001Index) => {
      const module001NormalizedName = module001Category.name.trim();

      if (module001CategoryIds.has(module001Category.categoryId)) {
        module001Context.addIssue({
          code: "custom",
          message: "类别编号重复",
          path: ["categories", module001Index, "categoryId"],
        });
      }

      if (module001CategoryNames.has(module001NormalizedName)) {
        module001Context.addIssue({
          code: "custom",
          message: "类别名称重复",
          path: ["categories", module001Index, "name"],
        });
      }

      module001CategoryIds.add(module001Category.categoryId);
      module001CategoryNames.add(module001NormalizedName);
    });

    module001Project.customFields.forEach((module001Field, module001Index) => {
      const module001NormalizedName = module001Field.name.trim();

      if (module001FieldIds.has(module001Field.fieldId)) {
        module001Context.addIssue({
          code: "custom",
          message: "字段编号重复",
          path: ["customFields", module001Index, "fieldId"],
        });
      }

      if (module001FieldNames.has(module001NormalizedName)) {
        module001Context.addIssue({
          code: "custom",
          message: "字段名称重复",
          path: ["customFields", module001Index, "name"],
        });
      }

      if (module001FixedFieldNames.has(module001NormalizedName)) {
        module001Context.addIssue({
          code: "custom",
          message: "字段名称与固定字段冲突",
          path: ["customFields", module001Index, "name"],
        });
      }

      if (
        module001Field.type === "select" &&
        new Set(module001Field.options).size !== module001Field.options.length
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "单选字段存在重复选项",
          path: ["customFields", module001Index, "options"],
        });
      }

      if (
        module001Field.type === "select" &&
        module001Field.options.length === 0
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "单选字段缺少选项",
          path: ["customFields", module001Index, "options"],
        });
      }

      if (
        module001Field.type !== "select" &&
        module001Field.options.length > 0
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "非单选字段不能包含选项",
          path: ["customFields", module001Index, "options"],
        });
      }

      if (module001FieldOrders.has(module001Field.order)) {
        module001Context.addIssue({
          code: "custom",
          message: "字段顺序重复",
          path: ["customFields", module001Index, "order"],
        });
      }

      const module001DefaultValueError = module001ValidateCustomValue(
        module001Field,
        module001Field.defaultValue ?? null,
      );
      if (module001DefaultValueError && module001Field.defaultValue != null) {
        module001Context.addIssue({
          code: "custom",
          message: `字段默认值无效：${module001DefaultValueError}`,
          path: ["customFields", module001Index, "defaultValue"],
        });
      }

      module001FieldIds.add(module001Field.fieldId);
      module001FieldNames.add(module001NormalizedName);
      module001FieldOrders.add(module001Field.order);
    });

    module001Project.assets.forEach((module001Asset, module001Index) => {
      const module001NormalizedCode = module001Asset.code.trim();

      if (module001AssetIds.has(module001Asset.assetId)) {
        module001Context.addIssue({
          code: "custom",
          message: "资产内部编号重复",
          path: ["assets", module001Index, "assetId"],
        });
      }

      if (
        module001Project.initializationStatus === "ready" &&
        module001NormalizedCode.length === 0
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "资产编号不能为空",
          path: ["assets", module001Index, "code"],
        });
      }

      if (
        module001Project.initializationStatus === "ready" &&
        module001Asset.name.trim().length === 0
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "资产名称不能为空",
          path: ["assets", module001Index, "name"],
        });
      }

      if (module001NormalizedCode && module001Codes.has(module001NormalizedCode)) {
        module001Context.addIssue({
          code: "custom",
          message: "资产编号重复，必须先合并",
          path: ["assets", module001Index, "code"],
        });
      }

      if (!module001CategoryIds.has(module001Asset.categoryId)) {
        module001Context.addIssue({
          code: "custom",
          message: "资产引用了不存在的类别",
          path: ["assets", module001Index, "categoryId"],
        });
      }

      module001Asset.modelNodeIds.forEach((module001NodeId) => {
        if (!module001NodeIds.has(module001NodeId)) {
          module001Context.addIssue({
            code: "custom",
            message: "资产引用了不存在的模型节点",
            path: ["assets", module001Index, "modelNodeIds"],
          });
        }

        if (module001NodeOwnerIds.has(module001NodeId)) {
          module001Context.addIssue({
            code: "custom",
            message: "同一模型节点不能属于多项资产",
            path: ["assets", module001Index, "modelNodeIds"],
          });
        } else {
          module001NodeOwnerIds.set(module001NodeId, module001Asset.assetId);
        }
      });

      const module001CustomValueKeys = Object.keys(
        module001Asset.customValues,
      );
      module001CustomValueKeys.forEach((module001FieldId) => {
        if (!module001FieldIds.has(module001FieldId)) {
          module001Context.addIssue({
            code: "custom",
            message: "资产包含未知自定义字段值",
            path: ["assets", module001Index, "customValues", module001FieldId],
          });
        }
      });
      module001Project.customFields.forEach((module001Field) => {
        const module001Value =
          module001Asset.customValues[module001Field.fieldId] ?? null;
        const module001ValueError = module001ValidateCustomValue(
          module001Field,
          module001Value,
        );
        if (module001ValueError) {
          module001Context.addIssue({
            code: "custom",
            message: `${module001Field.name}：${module001ValueError}`,
            path: [
              "assets",
              module001Index,
              "customValues",
              module001Field.fieldId,
            ],
          });
        }
      });

      module001AssetIds.add(module001Asset.assetId);
      if (module001NormalizedCode) {
        module001Codes.add(module001NormalizedCode);
      }
    });

    module001Project.modelNodes.forEach((module001Node, module001Index) => {
      if (module001SeenModelNodeIds.has(module001Node.modelNodeId)) {
        module001Context.addIssue({
          code: "custom",
          message: "模型节点编号重复",
          path: ["modelNodes", module001Index, "modelNodeId"],
        });
      }
      if (module001SceneNodeOrdinals.has(module001Node.sceneNodeOrdinal)) {
        module001Context.addIssue({
          code: "custom",
          message: "模型顶层场景顺序重复",
          path: ["modelNodes", module001Index, "sceneNodeOrdinal"],
        });
      }
      if (
        module001Node.sceneNodeOrdinal >=
        module001Project.model.topLevelNodeCount
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "模型顶层场景顺序超出范围",
          path: ["modelNodes", module001Index, "sceneNodeOrdinal"],
        });
      }

      if (module001Node.assetId && !module001AssetIds.has(module001Node.assetId)) {
        module001Context.addIssue({
          code: "custom",
          message: "模型节点引用了不存在的资产",
          path: ["modelNodes", module001Index, "assetId"],
        });
      }

      if (Boolean(module001Node.assetId) !== module001Node.isAssetObject) {
        module001Context.addIssue({
          code: "custom",
          message: "模型节点的资产对象状态不一致",
          path: ["modelNodes", module001Index, "isAssetObject"],
        });
      }

      if (module001Node.assetId && !module001Node.isCandidate) {
        module001Context.addIssue({
          code: "custom",
          message: "非候选场景对象不能关联资产",
          path: ["modelNodes", module001Index, "assetId"],
        });
      }

      if (
        module001Node.assetId &&
        module001NodeOwnerIds.get(module001Node.modelNodeId) !==
          module001Node.assetId
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "模型节点与资产的双向关联不一致",
          path: ["modelNodes", module001Index, "assetId"],
        });
      }

      if (
        !module001Node.assetId &&
        module001NodeOwnerIds.has(module001Node.modelNodeId)
      ) {
        module001Context.addIssue({
          code: "custom",
          message: "资产关联的模型节点没有反向资产编号",
          path: ["modelNodes", module001Index, "assetId"],
        });
      }
      module001SeenModelNodeIds.add(module001Node.modelNodeId);
      module001SceneNodeOrdinals.add(module001Node.sceneNodeOrdinal);
    });
  });

export const module001WorkspaceProjectSchema = z.object({
  projectId: z.string().min(1),
  directoryName: z.string().min(1),
  displayName: z.string().trim().min(1),
  createdAt: module001IsoDateTimeSchema,
  updatedAt: module001IsoDateTimeSchema,
  trashedAt: module001IsoDateTimeSchema.nullable(),
  projectFormatVersion: z.number().int().positive(),
  modelFileSize: z.number().int().nonnegative(),
  assetCount: z.number().int().nonnegative(),
});

export const module001WorkspaceSchema = z.object({
  workspaceFormatVersion: z.literal(module001WorkspaceFormatVersion),
  workspaceId: z.string().min(1),
  createdAt: module001IsoDateTimeSchema,
  updatedAt: module001IsoDateTimeSchema,
  projects: z.array(module001WorkspaceProjectSchema),
});

export const module001ProjectManifestSchema = z.object({
  packageFormatVersion: z.literal(module001PackageFormatVersion),
  projectFormatVersion: z.literal(module001ProjectFormatVersion),
  projectId: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: module001IsoDateTimeSchema,
  updatedAt: module001IsoDateTimeSchema,
  files: z.array(
    z.object({
      path: z.string().min(1),
      size: z.number().int().nonnegative(),
      required: z.boolean(),
    }),
  ),
});

/**
 * 校验自定义字段值是否符合字段定义，供表格与详情编辑共用。
 */
export function module001ValidateCustomValue(module001Field, module001Value) {
  if (module001Value === null || module001Value === "") {
    return module001Field.required ? "此字段为必填项" : null;
  }

  if (module001Field.type === "text" && typeof module001Value !== "string") {
    return "请输入文本";
  }

  if (module001Field.type === "number" && typeof module001Value !== "number") {
    return "请输入有效数字";
  }

  if (
    module001Field.type === "date" &&
    (typeof module001Value !== "string" ||
      !module001DateValueSchema.safeParse(module001Value).success)
  ) {
    return "请输入有效日期";
  }

  if (module001Field.type === "date") {
    const [module001Year, module001Month, module001Day] = module001Value
      .split("-")
      .map(Number);
    const module001Date = new Date(
      Date.UTC(module001Year, module001Month - 1, module001Day),
    );
    if (
      module001Date.getUTCFullYear() !== module001Year ||
      module001Date.getUTCMonth() !== module001Month - 1 ||
      module001Date.getUTCDate() !== module001Day
    ) {
      return "请输入有效日期";
    }
  }

  if (
    module001Field.type === "select" &&
    !module001Field.options.includes(module001Value)
  ) {
    return "请选择有效选项";
  }

  if (module001Field.type === "boolean" && typeof module001Value !== "boolean") {
    return "请选择是或否";
  }

  return null;
}
