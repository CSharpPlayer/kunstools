import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const module002RequestSchema = z.object({
  action: z.enum(["generate", "repair", "revise"]),
  model: z.string().min(1).max(80),
  prompt: z.string().min(1).max(1_500_000),
});
const module002RateBuckets = new Map();
const module002RateWindowMs = 60_000;
const module002RateLimit = 8;
const module002MaximumBodyBytes = 2 * 1024 * 1024;

/** 从环境变量读取模型白名单，默认采用已确认的 V4 两档模型。 */
function module002AllowedModels() {
  return (process.env.MODULE002_DEEPSEEK_MODELS ?? "deepseek-v4-flash,deepseek-v4-pro")
    .split(",")
    .map((module002Model) => module002Model.trim())
    .filter(Boolean);
}

/** 阻止跨站页面借用当前域名消耗 DeepSeek 额度。 */
function module002IsSameOrigin(module002Request) {
  const module002Origin = module002Request.headers.get("origin");
  if (!module002Origin) return false;
  return module002Origin === new URL(module002Request.url).origin;
}

/** 对单实例中的来源 IP 做轻量限流。 */
function module002ConsumeRateLimit(module002Request) {
  const module002Ip =
    module002Request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    module002Request.headers.get("x-real-ip") ||
    "local";
  const module002Now = Date.now();
  if (module002RateBuckets.size > 1_000) {
    module002RateBuckets.forEach((module002Value, module002Key) => {
      if (module002Now - module002Value.startedAt >= module002RateWindowMs) {
        module002RateBuckets.delete(module002Key);
      }
    });
  }
  const module002Bucket = module002RateBuckets.get(module002Ip);
  if (!module002Bucket || module002Now - module002Bucket.startedAt >= module002RateWindowMs) {
    module002RateBuckets.set(module002Ip, { startedAt: module002Now, count: 1 });
    return true;
  }
  if (module002Bucket.count >= module002RateLimit) return false;
  module002Bucket.count += 1;
  return true;
}

/** 返回模型白名单和服务端配置状态，不返回任何密钥。 */
export async function GET() {
  return Response.json({
    models: module002AllowedModels(),
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
  });
}

/** 仅在请求期间代理纯文本到 DeepSeek，不持久化也不记录正文。 */
export async function POST(module002Request) {
  if (!module002IsSameOrigin(module002Request)) {
    return Response.json({ error: "请求来源无效" }, { status: 403 });
  }
  if (!module002ConsumeRateLimit(module002Request)) {
    return Response.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const module002Length = Number(module002Request.headers.get("content-length") ?? 0);
  if (module002Length > module002MaximumBodyBytes) {
    return Response.json({ error: "请求内容超过 2MB 限制" }, { status: 413 });
  }
  const module002ApiKey = process.env.DEEPSEEK_API_KEY;
  if (!module002ApiKey) {
    return Response.json(
      { error: "服务端尚未配置 DEEPSEEK_API_KEY" },
      { status: 503 },
    );
  }

  let module002Payload;
  try {
    const module002RawBody = await module002Request.text();
    if (new TextEncoder().encode(module002RawBody).byteLength > module002MaximumBodyBytes) {
      return Response.json({ error: "请求内容超过 2MB 限制" }, { status: 413 });
    }
    module002Payload = module002RequestSchema.parse(JSON.parse(module002RawBody));
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  if (!module002AllowedModels().includes(module002Payload.model)) {
    return Response.json({ error: "所选模型不在服务端白名单中" }, { status: 400 });
  }
  const module002Controller = new AbortController();
  const module002Timeout = setTimeout(() => module002Controller.abort(), 90_000);
  try {
    const module002Response = await fetch(
      `${process.env.MODULE002_DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${module002ApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: module002Payload.model,
          messages: [
            {
              role: "system",
              content: "你只处理当前用户提供的会议文本。必须仅返回合法 json，不要添加 Markdown。",
            },
            { role: "user", content: module002Payload.prompt },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          max_tokens: 16_000,
          stream: false,
        }),
        cache: "no-store",
        signal: module002Controller.signal,
      },
    );
    if (!module002Response.ok) {
      const module002Status = [400, 401, 402, 429].includes(module002Response.status)
        ? module002Response.status
        : 502;
      return Response.json(
        { error: `DeepSeek 服务返回 ${module002Response.status}` },
        { status: module002Status },
      );
    }
    const module002Result = await module002Response.json();
    const module002Content = module002Result?.choices?.[0]?.message?.content;
    if (typeof module002Content !== "string" || !module002Content.trim()) {
      return Response.json({ error: "DeepSeek 返回了空内容" }, { status: 502 });
    }
    return Response.json({ content: module002Content });
  } catch (module002Error) {
    return Response.json(
      { error: module002Error?.name === "AbortError" ? "DeepSeek 请求超时" : "无法连接 DeepSeek" },
      { status: 504 },
    );
  } finally {
    clearTimeout(module002Timeout);
  }
}
