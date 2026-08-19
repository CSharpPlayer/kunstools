"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  module002CreateId,
  module002GetDefaultSpeechLength,
} from "../domain/module002Factories";
import {
  module002IsValidSpeechLength,
  module002SpeechLengthFieldId,
} from "../domain/module002Schemas";
import Module002Dialog from "../components/module002Dialog";

/** 提供三支部共用列结构的人物卡表格和 Excel 多行多列粘贴。 */
export default function Module002PeopleDialog({
  module002Open,
  module002OnClose,
  module002Config,
  module002OnChange,
  module002OnAddField,
  module002OnRemoveField,
}) {
  const [module002BranchId, setModule002BranchId] = useState(
    module002Config.branches[0]?.id,
  );
  const [module002PasteAnchor, setModule002PasteAnchor] = useState({ row: 0, column: 0 });
  const [module002NewFieldLabel, setModule002NewFieldLabel] = useState("");
  const [module002NewFieldType, setModule002NewFieldType] = useState("singleLine");
  const module002Fields = useMemo(
    () => [...module002Config.personFields].sort((a, b) => a.order - b.order),
    [module002Config.personFields],
  );
  const module002People = useMemo(
    () =>
      module002Config.people
        .filter((module002Person) => module002Person.branchId === module002BranchId)
        .sort((a, b) => a.order - b.order),
    [module002BranchId, module002Config.people],
  );
  const module002DuplicateNames = useMemo(() => {
    const module002Counts = new Map();
    module002People.forEach((module002Person) => {
      const module002Name = module002Person.name.trim();
      if (module002Name) {
        module002Counts.set(module002Name, (module002Counts.get(module002Name) ?? 0) + 1);
      }
    });
    return new Set(
      Array.from(module002Counts.entries())
        .filter(([, module002Count]) => module002Count > 1)
        .map(([module002Name]) => module002Name),
    );
  }, [module002People]);

  /** 为当前支部新增一行空人物卡。 */
  function module002AddPerson() {
    module002OnChange((module002NextConfig) => ({
      ...module002NextConfig,
      people: [
        ...module002NextConfig.people,
        {
          id: module002CreateId("person"),
          branchId: module002BranchId,
          order: module002People.length,
          name: "",
          values: { [module002SpeechLengthFieldId]: module002GetDefaultSpeechLength("") },
          isExample: false,
        },
      ],
    }));
  }

  /** 更新单个单元格，不让异常值影响整张表。 */
  function module002UpdateCell(module002PersonId, module002FieldId, module002Value) {
    if (
      module002FieldId === module002SpeechLengthFieldId
      && module002Value !== ""
      && !module002IsValidSpeechLength(module002Value)
    ) {
      return;
    }
    module002OnChange((module002NextConfig) => ({
      ...module002NextConfig,
      people: module002NextConfig.people.map((module002Person) => {
        if (module002Person.id !== module002PersonId) return module002Person;
        if (module002FieldId === "name") return { ...module002Person, name: module002Value };
        return {
          ...module002Person,
          values: { ...module002Person.values, [module002FieldId]: module002Value },
        };
      }),
    }));
  }

  /** 在当前支部中移动人物并重新写入稳定的显示顺序。 */
  function module002MovePerson(module002From, module002To) {
    if (module002To < 0 || module002To >= module002People.length) return;
    const module002OrderedIds = module002People.map((module002Person) => module002Person.id);
    const [module002MovedId] = module002OrderedIds.splice(module002From, 1);
    module002OrderedIds.splice(module002To, 0, module002MovedId);
    const module002OrderMap = new Map(
      module002OrderedIds.map((module002Id, module002Order) => [module002Id, module002Order]),
    );
    module002OnChange((module002NextConfig) => ({
      ...module002NextConfig,
      people: module002NextConfig.people.map((module002Person) =>
        module002OrderMap.has(module002Person.id)
          ? { ...module002Person, order: module002OrderMap.get(module002Person.id) }
          : module002Person,
      ),
    }));
  }

  /** 从当前焦点开始按可见列粘贴 Excel TSV 数据。 */
  function module002HandlePaste(module002Event) {
    const module002Text = module002Event.clipboardData.getData("text/plain");
    if (!module002Text.includes("\t") && !module002Text.includes("\n")) return;
    module002Event.preventDefault();
    const module002Rows = module002Text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((module002Row, module002Index, module002All) => module002Row || module002Index < module002All.length - 1)
      .map((module002Row) => module002Row.split("\t"));
    module002OnChange((module002NextConfig) => {
      const module002NextPeople = [...module002NextConfig.people];
      const module002BranchPeople = module002NextPeople
        .filter((module002Person) => module002Person.branchId === module002BranchId)
        .sort((a, b) => a.order - b.order);
      module002Rows.forEach((module002Cells, module002RowOffset) => {
        let module002Person = module002BranchPeople[module002PasteAnchor.row + module002RowOffset];
        if (!module002Person) {
          module002Person = {
            id: module002CreateId("person"),
            branchId: module002BranchId,
            order: module002BranchPeople.length,
            name: "",
            values: { [module002SpeechLengthFieldId]: module002GetDefaultSpeechLength("") },
            isExample: false,
          };
          module002BranchPeople.push(module002Person);
          module002NextPeople.push(module002Person);
        }
        module002Cells.forEach((module002Cell, module002ColumnOffset) => {
          const module002Field = module002Fields[module002PasteAnchor.column + module002ColumnOffset];
          if (!module002Field || module002Field.id === "serialNumber") return;
          if (module002Field.id === "name") module002Person.name = module002Cell.trim();
          else if (
            module002Field.id !== module002SpeechLengthFieldId
            || module002Cell.trim() === ""
            || module002IsValidSpeechLength(module002Cell)
          ) {
            module002Person.values = { ...module002Person.values, [module002Field.id]: module002Cell.trim() };
          }
        });
      });
      return { ...module002NextConfig, people: module002NextPeople };
    });
  }

  /** 经用户确认后删除自定义字段，以及所有人物卡内的对应内容。 */
  function module002RemoveField(module002Field) {
    if (!window.confirm(`确定删除“${module002Field.label}”字段吗？所有人物卡中的该字段内容也会被删除。`)) {
      return;
    }
    module002OnRemoveField(module002Field.id);
  }

  return (
    <Module002Dialog
      module002Description="三个支部使用相同列结构；可直接从 Excel 复制多行多列。"
      module002OnClose={module002OnClose}
      module002Open={module002Open}
      module002Title="人物卡"
      module002Wide
    >
      <div className="module002BranchTabs" role="tablist">
        {module002Config.branches.map((module002Branch) => (
          <button
            aria-selected={module002Branch.id === module002BranchId}
            className={module002Branch.id === module002BranchId ? "isActive" : ""}
            key={module002Branch.id}
            onClick={() => setModule002BranchId(module002Branch.id)}
            role="tab"
            type="button"
          >
            {module002Branch.name}
          </button>
        ))}
      </div>
      <div className="module002PeopleActions">
        <button className="module002SecondaryButton" onClick={module002AddPerson} type="button"><Plus size={15} />新增人物</button>
        {module002Config.people.some((module002Person) => module002Person.isExample) ? (
          <button className="module002DangerButton" onClick={() => module002OnChange((module002NextConfig) => ({ ...module002NextConfig, people: module002NextConfig.people.filter((module002Person) => !module002Person.isExample) }))} type="button">清空全部示例</button>
        ) : null}
        <label>
          <span className="sr-only">新字段名称</span>
          <input onChange={(event) => setModule002NewFieldLabel(event.target.value)} placeholder="新字段名称" value={module002NewFieldLabel} />
        </label>
        <label>
          <span className="sr-only">新字段类型</span>
          <select
            aria-label="新字段类型"
            onChange={(event) => setModule002NewFieldType(event.target.value)}
            value={module002NewFieldType}
          >
            <option value="singleLine">单行</option>
            <option value="multiLine">多行</option>
          </select>
        </label>
        <button
          className="module002SecondaryButton"
          disabled={!module002NewFieldLabel.trim()}
          onClick={() => {
            module002OnAddField(module002NewFieldLabel.trim(), module002NewFieldType);
            setModule002NewFieldLabel("");
          }}
          type="button"
        >
          添加字段列
        </button>
      </div>
      <p className="module002PeoplePasteRule">粘贴规则：从当前单元格开始，按当前可见列从左到右匹配 Excel 内容。</p>
      {module002DuplicateNames.size ? <p className="module002PeopleWarning" role="alert">当前支部存在重复姓名；生成前必须修改。</p> : null}
      <div className="module002PeopleTableWrap" onPaste={module002HandlePaste}>
        <table className="module002PeopleTable">
          <thead><tr>{module002Fields.map((module002Field) => <th key={module002Field.id}>{module002Field.builtIn ? module002Field.label : <span className="module002PeopleFieldHeader"><span>{module002Field.label}</span><button aria-label={`删除字段 ${module002Field.label}`} onClick={() => module002RemoveField(module002Field)} title={`删除 ${module002Field.label}`} type="button"><Trash2 size={13} /></button></span>}</th>)}<th aria-label="操作" /></tr></thead>
          <tbody>
            {module002People.length ? module002People.map((module002Person, module002RowIndex) => (
              <tr key={module002Person.id}>
                {module002Fields.map((module002Field, module002ColumnIndex) => (
                  <td key={module002Field.id}>
                    {module002Field.id === "serialNumber" ? module002RowIndex + 1 : (
                      module002Field.type === "multiLine" ? (
                        <textarea
                          aria-label={`${module002Person.name || "未命名人物"} ${module002Field.label}`}
                          onChange={(event) => module002UpdateCell(module002Person.id, module002Field.id, event.target.value)}
                          onFocus={() => setModule002PasteAnchor({ row: module002RowIndex, column: module002ColumnIndex })}
                          rows="2"
                          value={module002Person.values[module002Field.id] ?? ""}
                        />
                      ) : (
                        <input
                          aria-invalid={
                            (module002Field.id === "name" && module002DuplicateNames.has(module002Person.name.trim()))
                            || (
                              module002Field.id === module002SpeechLengthFieldId
                              && module002Person.values[module002Field.id]
                              && !module002IsValidSpeechLength(module002Person.values[module002Field.id])
                            )
                          }
                          aria-label={`${module002Person.name || "未命名人物"} ${module002Field.label}`}
                          inputMode={module002Field.id === module002SpeechLengthFieldId ? "numeric" : undefined}
                          onChange={(event) => module002UpdateCell(module002Person.id, module002Field.id, event.target.value)}
                          onFocus={() => setModule002PasteAnchor({ row: module002RowIndex, column: module002ColumnIndex })}
                          value={module002Field.id === "name" ? module002Person.name : module002Person.values[module002Field.id] ?? ""}
                        />
                      )
                    )}
                  </td>
                ))}
                <td className="module002PeopleRowActions"><button aria-label={`上移 ${module002Person.name || "未命名人物"}`} className="module002IconButton" disabled={module002RowIndex === 0} onClick={() => module002MovePerson(module002RowIndex, module002RowIndex - 1)} type="button"><ArrowUp size={14} /></button><button aria-label={`下移 ${module002Person.name || "未命名人物"}`} className="module002IconButton" disabled={module002RowIndex === module002People.length - 1} onClick={() => module002MovePerson(module002RowIndex, module002RowIndex + 1)} type="button"><ArrowDown size={14} /></button><button aria-label={`删除 ${module002Person.name || "未命名人物"}`} className="module002IconButton" onClick={() => module002OnChange((module002NextConfig) => ({ ...module002NextConfig, people: module002NextConfig.people.filter((item) => item.id !== module002Person.id) }))} type="button"><Trash2 size={15} /></button></td>
              </tr>
            )) : <tr><td className="module002EmptyCell" colSpan={module002Fields.length + 1}>当前支部暂无人物</td></tr>}
          </tbody>
        </table>
      </div>
    </Module002Dialog>
  );
}
