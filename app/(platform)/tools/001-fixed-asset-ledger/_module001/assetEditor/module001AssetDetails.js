"use client";

import {
  GitMerge,
  GitPullRequest,
  Link2,
  Link2Off,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  module001CollectProjectErrors,
  module001GetAssetColor,
} from "../domain/module001ProjectCommands";
import Module001EditableCell from "../ledger/module001EditableCell";
import { module001UseStore } from "../state/module001Store";

/**
 * 渲染持续选中资产的字段和模型节点关联详情。
 */
export default function Module001AssetDetails({
  module001OnCommit,
  module001OnAddNodes,
  module001OnRemoveNode,
  module001OnMerge,
  module001OnSplit,
  module001OnDelete,
}) {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001SelectedAssetId = module001UseStore(
    (module001State) => module001State.selectedAssetId,
  );
  const module001IsWriter = module001UseStore(
    (module001State) => module001State.isWriter,
  );
  const module001Asset = module001Project.assets.find(
    (module001Item) => module001Item.assetId === module001SelectedAssetId,
  );

  if (!module001Asset) {
    return (
      <aside className="module001AssetDetails module001AssetDetailsEmpty">
        <span>选择一项资产查看详情</span>
      </aside>
    );
  }

  const module001Errors = module001CollectProjectErrors(
    module001Project,
  ).filter(
    (module001Error) => module001Error.assetId === module001Asset.assetId,
  );
  const module001ErrorMap = new Map(
    module001Errors.map((module001Error) => [
      module001Error.fieldId,
      module001Error.message,
    ]),
  );
  const module001CategoryOptions = module001Project.categories.map(
    (module001Category) => ({
      value: module001Category.categoryId,
      label: module001Category.name,
    }),
  );

  return (
    <aside className="module001AssetDetails" aria-label="资产详情">
      <header>
        <div>
          <span className="module001Eyebrow">资产详情</span>
          <strong>{module001Asset.name || "未命名资产"}</strong>
        </div>
        <div className="module001Toolbar">
          <button
            className="module001IconButton"
            disabled={!module001IsWriter}
            onClick={() => module001OnMerge(module001Asset.assetId)}
            title="合并资产"
            type="button"
          >
            <GitMerge size={15} aria-hidden="true" />
          </button>
          <button
            className="module001IconButton"
            disabled={
              !module001IsWriter || module001Asset.modelNodeIds.length < 2
            }
            onClick={() => module001OnSplit(module001Asset.assetId)}
            title="拆分资产"
            type="button"
          >
            <GitPullRequest size={15} aria-hidden="true" />
          </button>
          <button
            className="module001IconButton"
            disabled={!module001IsWriter}
            onClick={() => module001OnDelete(module001Asset.assetId)}
            title="删除资产"
            type="button"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      {module001Errors.length > 0 ? (
        <div className="module001DetailsErrors" role="alert">
          {module001Errors.map((module001Error) => (
            <span key={`${module001Error.fieldId}:${module001Error.message}`}>
              {module001Error.message}
            </span>
          ))}
        </div>
      ) : null}

      <div className="module001DetailsFields">
        <label>
          <span>编号</span>
          <Module001EditableCell
            key={`code:${module001Asset.assetId}:${module001Asset.code}`}
            module001Asset={module001Asset}
            module001Disabled={!module001IsWriter}
            module001Error={module001ErrorMap.get("code")}
            module001FieldId="code"
            module001OnCommit={module001OnCommit}
            module001Type="text"
            module001Value={module001Asset.code}
          />
        </label>
        <label>
          <span>名称</span>
          <Module001EditableCell
            key={`name:${module001Asset.assetId}:${module001Asset.name}`}
            module001Asset={module001Asset}
            module001Disabled={!module001IsWriter}
            module001Error={module001ErrorMap.get("name")}
            module001FieldId="name"
            module001OnCommit={module001OnCommit}
            module001Type="text"
            module001Value={module001Asset.name}
          />
        </label>
        <label>
          <span>类别</span>
          <Module001EditableCell
            key={`categoryId:${module001Asset.assetId}:${module001Asset.categoryId}`}
            module001Asset={module001Asset}
            module001Disabled={!module001IsWriter}
            module001Error={module001ErrorMap.get("categoryId")}
            module001FieldId="categoryId"
            module001OnCommit={module001OnCommit}
            module001Options={module001CategoryOptions}
            module001Type="select"
            module001Value={module001Asset.categoryId}
          />
        </label>
        <label>
          <span>高亮颜色</span>
          <div className="module001ColorDetail">
            <Module001EditableCell
              key={`highlightColor:${module001Asset.assetId}`}
              module001Asset={module001Asset}
              module001ColorPickerId={`details:${module001Asset.assetId}:highlightColor`}
              module001Disabled={!module001IsWriter}
              module001FieldId="highlightColor"
              module001OnCommit={module001OnCommit}
              module001Type="color"
              module001Value={module001GetAssetColor(
                module001Project,
                module001Asset,
              )}
            />
            <button
              className="module001IconButton"
              disabled={
                !module001IsWriter || !module001Asset.highlightColorOverride
              }
              onClick={() =>
                module001OnCommit(
                  module001Asset.assetId,
                  "highlightColorReset",
                  null,
                )
              }
              title="恢复继承类别颜色"
              type="button"
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </div>
        </label>
        {module001Project.customFields.map((module001Field) => (
          <label key={module001Field.fieldId}>
            <span>
              {module001Field.name}
              {module001Field.required ? " *" : ""}
            </span>
            <Module001EditableCell
              key={`${module001Field.fieldId}:${module001Asset.assetId}:${String(
                module001Asset.customValues[module001Field.fieldId] ?? null,
              )}`}
              module001Asset={module001Asset}
              module001Disabled={!module001IsWriter}
              module001Error={module001ErrorMap.get(module001Field.fieldId)}
              module001FieldId={module001Field.fieldId}
              module001OnCommit={module001OnCommit}
              module001Options={module001Field.options.map(
                (module001Option) => ({
                  value: module001Option,
                  label: module001Option,
                }),
              )}
              module001Type={module001Field.type}
              module001Value={
                module001Asset.customValues[module001Field.fieldId] ?? null
              }
            />
          </label>
        ))}
      </div>

      <section className="module001NodeAssociations">
        <header>
          <div>
            <Link2 size={15} aria-hidden="true" />
            <strong>关联模型节点</strong>
            <span>{module001Asset.modelNodeIds.length}</span>
          </div>
          <button
            className="module001SecondaryButton"
            disabled={
              !module001IsWriter ||
              !module001Project.modelNodes.some(
                (module001Node) =>
                  module001Node.isCandidate && !module001Node.assetId,
              )
            }
            onClick={() => module001OnAddNodes(module001Asset.assetId)}
            type="button"
          >
            添加节点
          </button>
        </header>
        <ul>
          {module001Asset.modelNodeIds.map((module001NodeId) => {
            const module001Node = module001Project.modelNodes.find(
              (module001Item) =>
                module001Item.modelNodeId === module001NodeId,
            );
            return (
              <li key={module001NodeId}>
                <span title={module001Node?.displayPath}>
                  {module001Node?.displayPath ?? module001NodeId}
                </span>
                <button
                  aria-label="移除此节点关联"
                  className="module001IconButton"
                  disabled={
                    !module001IsWriter ||
                    module001Asset.modelNodeIds.length <= 1
                  }
                  onClick={() =>
                    module001OnRemoveNode(
                      module001Asset.assetId,
                      module001NodeId,
                    )
                  }
                  title="移除并退回未配置对象"
                  type="button"
                >
                  <Link2Off size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
