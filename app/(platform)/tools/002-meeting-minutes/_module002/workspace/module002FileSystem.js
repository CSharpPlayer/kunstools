const module002TextEncoder = new TextEncoder();

/** 读取 UTF-8 文件；不存在时返回 null。 */
export async function module002ReadOptionalText(
  module002DirectoryHandle,
  module002FileName,
) {
  try {
    const module002FileHandle = await module002DirectoryHandle.getFileHandle(
      module002FileName,
    );
    return (await module002FileHandle.getFile()).text();
  } catch (module002Error) {
    if (module002Error?.name === "NotFoundError") return null;
    throw module002Error;
  }
}

/** 完整关闭写入流后才报告保存成功。 */
export async function module002WriteFile(
  module002DirectoryHandle,
  module002FileName,
  module002Content,
) {
  const module002FileHandle = await module002DirectoryHandle.getFileHandle(
    module002FileName,
    { create: true },
  );
  const module002Writable = await module002FileHandle.createWritable();
  try {
    await module002Writable.write(module002Content);
    await module002Writable.close();
  } catch (module002Error) {
    await module002Writable.abort?.(module002Error).catch(() => {});
    throw module002Error;
  }
}

/** 用恢复文件→校验→主文件的两阶段顺序保存小型 JSON。 */
export async function module002SafeWriteJson({
  module002DirectoryHandle,
  module002PrimaryName,
  module002RecoveryName,
  module002Value,
  module002Validate,
}) {
  const module002Text = `${JSON.stringify(module002Value, null, 2)}\n`;
  const module002Encoded = module002TextEncoder.encode(module002Text);
  await module002WriteFile(
    module002DirectoryHandle,
    module002RecoveryName,
    module002Encoded,
  );
  module002Validate(
    await module002ReadOptionalText(module002DirectoryHandle, module002RecoveryName),
  );
  await module002WriteFile(
    module002DirectoryHandle,
    module002PrimaryName,
    module002Encoded,
  );
  return module002Value;
}
