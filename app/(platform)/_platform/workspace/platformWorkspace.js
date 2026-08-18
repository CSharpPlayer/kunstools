const platformWorkspaceDatabaseName = "kunstools.platform.workspace.v1";
const platformWorkspaceStoreName = "sharedRoot";
const platformWorkspaceRecordKey = "current";

/**
 * 检查浏览器是否支持由平台统一管理的本地目录访问。
 */
export function platformGetWorkspaceCapability() {
  const platformSupported =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.showDirectoryPicker === "function";

  return {
    supported: platformSupported,
    reason: platformSupported
      ? null
      : "请使用最新版 Chrome 或 Edge，并通过 localhost 或 HTTPS 打开本站。",
  };
}

/**
 * 仅由主页中明确的用户点击动作选择平台共享根目录。
 */
export async function platformChooseWorkspaceDirectory() {
  const platformCapability = platformGetWorkspaceCapability();

  if (!platformCapability.supported) {
    throw new Error(platformCapability.reason);
  }

  return window.showDirectoryPicker({
    id: "kunstools-platform-workspace",
    mode: "readwrite",
    startIn: "documents",
  });
}

/**
 * 查询共享根目录的读写权限；只有主页的按钮会请求重新授权。
 */
export async function platformEnsureWorkspacePermission(
  platformWorkspaceHandle,
  platformMayRequest = false,
) {
  const platformOptions = { mode: "readwrite" };
  const platformPermission = await platformWorkspaceHandle.queryPermission(
    platformOptions,
  );

  if (platformPermission === "granted") {
    return true;
  }

  if (!platformMayRequest) {
    return false;
  }

  return (
    (await platformWorkspaceHandle.requestPermission(platformOptions)) ===
    "granted"
  );
}

/**
 * 仅在模块第一次实际打开时，创建或取得它在共享根目录中的专属文件夹。
 */
export async function platformOpenModuleWorkspace(
  platformRootHandle,
  platformModuleFolderName,
) {
  return platformRootHandle.getDirectoryHandle(platformModuleFolderName, {
    create: true,
  });
}

/**
 * 打开只保存共享根目录句柄的浏览器私有数据库，不保存任何业务数据。
 */
function platformOpenWorkspaceDatabase() {
  return new Promise((platformResolve, platformReject) => {
    const platformRequest = indexedDB.open(platformWorkspaceDatabaseName, 1);

    platformRequest.onupgradeneeded = () => {
      const platformDatabase = platformRequest.result;

      if (!platformDatabase.objectStoreNames.contains(platformWorkspaceStoreName)) {
        platformDatabase.createObjectStore(platformWorkspaceStoreName);
      }
    };
    platformRequest.onsuccess = () => platformResolve(platformRequest.result);
    platformRequest.onerror = () => platformReject(platformRequest.error);
  });
}

/**
 * 记住用户从主页选择的唯一共享根目录。
 */
export async function platformRememberWorkspace(platformRootHandle) {
  const platformDatabase = await platformOpenWorkspaceDatabase();

  try {
    await new Promise((platformResolve, platformReject) => {
      const platformTransaction = platformDatabase.transaction(
        platformWorkspaceStoreName,
        "readwrite",
      );
      const platformStore = platformTransaction.objectStore(
        platformWorkspaceStoreName,
      );

      platformStore.put(
        {
          handle: platformRootHandle,
          name: platformRootHandle.name,
          rememberedAt: new Date().toISOString(),
        },
        platformWorkspaceRecordKey,
      );
      platformTransaction.oncomplete = platformResolve;
      platformTransaction.onerror = () =>
        platformReject(platformTransaction.error);
      platformTransaction.onabort = () => platformReject(platformTransaction.error);
    });
  } finally {
    platformDatabase.close();
  }
}

/**
 * 读取平台最近一次选择的共享根目录句柄。
 */
export async function platformReadRememberedWorkspace() {
  const platformDatabase = await platformOpenWorkspaceDatabase();

  try {
    return await new Promise((platformResolve, platformReject) => {
      const platformRequest = platformDatabase
        .transaction(platformWorkspaceStoreName, "readonly")
        .objectStore(platformWorkspaceStoreName)
        .get(platformWorkspaceRecordKey);

      platformRequest.onsuccess = () =>
        platformResolve(platformRequest.result ?? null);
      platformRequest.onerror = () => platformReject(platformRequest.error);
    });
  } finally {
    platformDatabase.close();
  }
}

/**
 * 忘记浏览器中的共享根目录句柄，不会触碰磁盘中的任何文件。
 */
export async function platformForgetWorkspace() {
  const platformDatabase = await platformOpenWorkspaceDatabase();

  try {
    await new Promise((platformResolve, platformReject) => {
      const platformTransaction = platformDatabase.transaction(
        platformWorkspaceStoreName,
        "readwrite",
      );

      platformTransaction
        .objectStore(platformWorkspaceStoreName)
        .delete(platformWorkspaceRecordKey);
      platformTransaction.oncomplete = platformResolve;
      platformTransaction.onerror = () =>
        platformReject(platformTransaction.error);
      platformTransaction.onabort = () => platformReject(platformTransaction.error);
    });
  } finally {
    platformDatabase.close();
  }
}
