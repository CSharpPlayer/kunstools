import { module001CreateWorkspace } from "../domain/module001Factories";
import { module001ParseWorkspaceText } from "../domain/module001Migrations";
import { module001WorkspaceSchema } from "../domain/module001Schemas";

const module001TextEncoder = new TextEncoder();

/**
 * 查询或在用户手势内请求目录读写权限。
 */
export async function module001EnsureDirectoryPermission(
  module001Handle,
  module001MayRequest = false,
) {
  const module001Options = { mode: "readwrite" };
  const module001CurrentPermission = await module001Handle.queryPermission(
    module001Options,
  );

  if (module001CurrentPermission === "granted") {
    return true;
  }

  if (!module001MayRequest) {
    return false;
  }

  return (
    (await module001Handle.requestPermission(module001Options)) === "granted"
  );
}

/**
 * 读取目录中的 UTF-8 文本文件。
 */
export async function module001ReadTextFile(
  module001DirectoryHandle,
  module001FileName,
) {
  const module001FileHandle = await module001DirectoryHandle.getFileHandle(
    module001FileName,
  );
  const module001File = await module001FileHandle.getFile();
  return module001File.text();
}

/**
 * 安全创建独占写入流；旧浏览器不支持 mode 时自动使用兼容调用。
 */
export async function module001CreateWritable(module001FileHandle) {
  try {
    return await module001FileHandle.createWritable({ mode: "exclusive" });
  } catch (module001Error) {
    if (module001Error instanceof TypeError) {
      return module001FileHandle.createWritable();
    }

    throw module001Error;
  }
}

/**
 * 原子式写入小型文本或二进制内容，并在关闭流后才视为成功。
 */
export async function module001WriteFile(
  module001DirectoryHandle,
  module001FileName,
  module001Content,
) {
  const module001FileHandle = await module001DirectoryHandle.getFileHandle(
    module001FileName,
    { create: true },
  );
  const module001Writable = await module001CreateWritable(module001FileHandle);

  try {
    await module001Writable.write(module001Content);
    await module001Writable.close();
  } catch (module001Error) {
    await module001Writable.abort(module001Error).catch(() => {});
    throw module001Error;
  }

  return module001FileHandle;
}

/**
 * 使用浏览器流逐块复制大型文件，不转换 Base64 或额外组合完整 Blob。
 */
export async function module001CopyFileStream({
  module001SourceFile,
  module001TargetDirectory,
  module001TargetName,
  module001Signal,
  module001OnProgress,
}) {
  const module001TargetHandle = await module001TargetDirectory.getFileHandle(
    module001TargetName,
    { create: true },
  );
  const module001Writable = await module001CreateWritable(module001TargetHandle);
  const module001Reader = module001SourceFile.stream().getReader();
  let module001WrittenBytes = 0;

  try {
    while (true) {
      if (module001Signal?.aborted) {
        throw new DOMException("复制已取消", "AbortError");
      }

      const { done: module001Done, value: module001Chunk } =
        await module001Reader.read();

      if (module001Done) {
        break;
      }

      await module001Writable.write(module001Chunk);
      module001WrittenBytes += module001Chunk.byteLength;
      module001OnProgress?.({
        writtenBytes: module001WrittenBytes,
        totalBytes: module001SourceFile.size,
      });
    }

    await module001Writable.close();
  } catch (module001Error) {
    await module001Reader.cancel(module001Error).catch(() => {});
    await module001Writable.abort(module001Error).catch(() => {});
    throw module001Error;
  }

  return module001TargetHandle;
}

/**
 * 写入经过 schema 校验的工作区清单。
 */
export async function module001WriteWorkspace(
  module001WorkspaceHandle,
  module001Workspace,
) {
  const module001ValidatedWorkspace = module001WorkspaceSchema.parse({
    ...module001Workspace,
    updatedAt: new Date().toISOString(),
  });
  const module001Text = `${JSON.stringify(module001ValidatedWorkspace, null, 2)}\n`;

  await module001WriteFile(
    module001WorkspaceHandle,
    "workspace.json",
    module001TextEncoder.encode(module001Text),
  );
  return module001ValidatedWorkspace;
}

/**
 * 打开已有工作区，或在空目录中建立带版本号的新工作区。
 */
export async function module001OpenOrCreateWorkspace(module001WorkspaceHandle) {
  await module001WorkspaceHandle.getDirectoryHandle("projects", { create: true });

  try {
    const module001WorkspaceText = await module001ReadTextFile(
      module001WorkspaceHandle,
      "workspace.json",
    );
    return module001ParseWorkspaceText(module001WorkspaceText);
  } catch (module001Error) {
    if (module001Error?.name !== "NotFoundError") {
      throw module001Error;
    }

    return module001WriteWorkspace(
      module001WorkspaceHandle,
      module001CreateWorkspace(),
    );
  }
}

/**
 * 在临时或失败项目未登记时安全移除其限定子目录。
 */
export async function module001RemoveProjectDirectory(
  module001WorkspaceHandle,
  module001DirectoryName,
) {
  const module001ProjectsHandle = await module001WorkspaceHandle.getDirectoryHandle(
    "projects",
  );
  await module001ProjectsHandle.removeEntry(module001DirectoryName, {
    recursive: true,
  });
}
