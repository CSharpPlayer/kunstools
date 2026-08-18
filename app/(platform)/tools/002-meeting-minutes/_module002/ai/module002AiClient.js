/** 读取服务端当前允许使用的 DeepSeek 模型。 */
export async function module002LoadModels() {
  const module002Response = await fetch("/tools/002-meeting-minutes/api/deepseek", {
    cache: "no-store",
  });
  if (!module002Response.ok) throw new Error("无法读取模型列表");
  return module002Response.json();
}

/** 调用模块服务端代理；瞬时错误最多自动重试一次。 */
export async function module002RequestAi(module002Payload, module002Signal) {
  let module002LastError;
  for (let module002Attempt = 0; module002Attempt < 2; module002Attempt += 1) {
    try {
      const module002Response = await fetch(
        "/tools/002-meeting-minutes/api/deepseek",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(module002Payload),
          signal: module002Signal,
        },
      );
      const module002Body = await module002Response.json().catch(() => ({}));
      if (!module002Response.ok) {
        const module002Error = new Error(module002Body.error ?? "AI 请求失败");
        module002Error.retryable = [408, 429, 500, 502, 503, 504].includes(module002Response.status);
        throw module002Error;
      }
      return module002Body;
    } catch (module002Error) {
      module002LastError = module002Error;
      if (module002Signal?.aborted || !module002Error.retryable || module002Attempt === 1) throw module002Error;
      await new Promise((module002Resolve) => window.setTimeout(module002Resolve, 600));
    }
  }
  throw module002LastError;
}
