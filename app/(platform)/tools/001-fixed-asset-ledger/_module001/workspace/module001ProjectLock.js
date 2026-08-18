/**
 * 为一个项目申请跨标签页独占写锁，并返回可显式释放的控制器。
 */
export async function module001AcquireProjectLock(module001ProjectId) {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return {
      isWriter: false,
      reason: "当前浏览器不支持项目单写入锁",
      release() {},
    };
  }

  const module001LockName = `kunstools.module001.project.${module001ProjectId}`;
  const module001Channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel(module001LockName)
      : null;
  let module001ReleaseHold;
  const module001HoldPromise = new Promise((module001Resolve) => {
    module001ReleaseHold = module001Resolve;
  });
  let module001ResolveAcquired;
  let module001RejectAcquired;
  const module001AcquiredPromise = new Promise(
    (module001Resolve, module001Reject) => {
      module001ResolveAcquired = module001Resolve;
      module001RejectAcquired = module001Reject;
    },
  );

  const module001RequestPromise = navigator.locks
    .request(
      module001LockName,
      { mode: "exclusive", ifAvailable: true },
      async (module001Lock) => {
        if (!module001Lock) {
          module001ResolveAcquired(false);
          return;
        }

        module001ResolveAcquired(true);
        module001Channel?.postMessage({ type: "writer-active" });
        await module001HoldPromise;
      },
    )
    .catch((module001Error) => {
      module001RejectAcquired(module001Error);
    });
  const module001IsWriter = await module001AcquiredPromise;
  let module001Released = false;

  return {
    isWriter: module001IsWriter,
    reason: module001IsWriter ? null : "此项目正在另一个标签页中编辑",
    /**
     * 释放当前项目锁，让其他标签页可以重新申请编辑权。
     */
    release() {
      if (module001Released) {
        return;
      }

      module001Released = true;
      module001ReleaseHold();
      module001RequestPromise.finally(() => module001Channel?.close());
    },
  };
}
