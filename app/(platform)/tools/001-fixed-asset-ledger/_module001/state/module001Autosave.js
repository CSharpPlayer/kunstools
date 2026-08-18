"use client";

import { useEffect, useRef } from "react";
import { module001ProjectSchema } from "../domain/module001Schemas";
import { module001SaveProject } from "../workspace/module001ProjectRepository";
import { module001WriteWorkspace } from "../workspace/module001FileSystem";
import { module001UseStore } from "./module001Store";

/**
 * 串行、防抖地保存项目，并在失败时保留内存中的脏状态。
 */
export function useModule001Autosave() {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001ProjectDirectory = module001UseStore(
    (module001State) => module001State.projectDirectory,
  );
  const module001Workspace = module001UseStore(
    (module001State) => module001State.workspace,
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
  const module001SetSaveState = module001UseStore(
    (module001State) => module001State.setSaveState,
  );
  const module001SetWorkspaceData = module001UseStore(
    (module001State) => module001State.setWorkspaceData,
  );
  const module001QueueRef = useRef(Promise.resolve());
  const module001LastSavedRevisionRef = useRef(null);

  useEffect(() => {
    if (
      !module001IsWriter ||
      !module001Project ||
      !module001ProjectDirectory ||
      !module001Workspace ||
      !module001WorkspaceHandle ||
      module001SaveStatus === "saving" ||
      module001SaveStatus === "error" ||
      module001LastSavedRevisionRef.current === module001Project.revision
    ) {
      return undefined;
    }

    const module001Timer = window.setTimeout(() => {
      const module001Snapshot = structuredClone(module001Project);
      module001SetSaveState("saving");
      module001QueueRef.current = module001QueueRef.current
        .catch(() => {})
        .then(async () => {
          module001ProjectSchema.parse(module001Snapshot);
          await module001SaveProject(
            module001ProjectDirectory,
            module001Snapshot,
          );

          const module001NextWorkspace = await module001WriteWorkspace(
            module001WorkspaceHandle,
            {
              ...module001Workspace,
              projects: module001Workspace.projects.map((module001Summary) =>
                module001Summary.projectId === module001Snapshot.projectId
                  ? {
                      ...module001Summary,
                      displayName: module001Snapshot.displayName,
                      updatedAt: module001Snapshot.updatedAt,
                      assetCount: module001Snapshot.assets.length,
                    }
                  : module001Summary,
              ),
            },
          );

          module001LastSavedRevisionRef.current = module001Snapshot.revision;
          module001SetWorkspaceData(module001NextWorkspace);
          module001SetSaveState("saved");
        })
        .catch((module001Error) => {
          module001SetSaveState(
            "error",
            module001Error instanceof Error
              ? module001Error.message
              : "保存失败，请重新授权或导出应急副本",
          );
        });
    }, 650);

    return () => window.clearTimeout(module001Timer);
  }, [
    module001IsWriter,
    module001Project,
    module001ProjectDirectory,
    module001SaveStatus,
    module001SetSaveState,
    module001SetWorkspaceData,
    module001Workspace,
    module001WorkspaceHandle,
  ]);
}
