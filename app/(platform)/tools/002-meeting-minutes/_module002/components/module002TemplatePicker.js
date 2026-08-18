"use client";

import Module002Dialog from "./module002Dialog";

/** 按“支部 → 模板”层级选择新会议模板。 */
export default function Module002TemplatePicker({
  module002Open,
  module002Config,
  module002OnChoose,
  module002OnClose,
}) {
  return (
    <Module002Dialog module002Description="模板会复制为当前草稿快照。" module002OnClose={module002OnClose} module002Open={module002Open} module002Title="选择党支部模板">
      <div className="module002TemplatePicker">
        {module002Config.branches.map((module002Branch) => {
          const module002Templates = module002Config.templates.filter((item) => item.branchId === module002Branch.id);
          return (
            <section key={module002Branch.id}>
              <h3>{module002Branch.name}</h3>
              {module002Templates.length ? module002Templates.map((module002Template) => (
                <button key={module002Template.id} onClick={() => module002OnChoose(module002Template.id)} type="button">{module002Template.name}</button>
              )) : <p>暂无模板</p>}
            </section>
          );
        })}
      </div>
    </Module002Dialog>
  );
}
