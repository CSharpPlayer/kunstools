import {
  module002FindCandidateParagraphs,
  module002GetSupportedFileType,
  module002SplitParagraphText,
} from "./module002CandidateParagraphs";

export const module002MaximumFileCount = 20;
export const module002MaximumFileBytes = 20 * 1024 * 1024;
export const module002MaximumPdfPages = 50;

let module002OcrWorkerPromise = null;
let module002OcrProgressListener = null;
let module002OcrQueue = Promise.resolve();

/** 按需启动完全由本站静态资源驱动的中文 OCR Worker。 */
async function module002GetOcrWorker() {
  if (!module002OcrWorkerPromise) {
    module002OcrWorkerPromise = import("tesseract.js").then(
      async ({ createWorker: module002CreateWorker, OEM: module002Oem }) =>
        module002CreateWorker("chi_sim", module002Oem.LSTM_ONLY, {
          workerPath: "/module002/ocr/worker.min.js",
          corePath: "/module002/ocr/core",
          langPath: "/module002/ocr/lang",
          logger: (module002Message) => module002OcrProgressListener?.({
            stage: "ocr",
            ratio: Number.isFinite(module002Message.progress)
              ? module002Message.progress
              : 0,
            detail: module002Message.status,
          }),
        }),
    );
  }
  return module002OcrWorkerPromise;
}

/** 串行执行 OCR，避免同一 Worker 并发识别时进度串线或 WASM 状态冲突。 */
function module002Recognize(module002Input, module002Signal, module002OnProgress) {
  const module002Task = module002OcrQueue.then(async () => {
    module002ThrowIfAborted(module002Signal);
    module002OcrProgressListener = module002OnProgress;
    try {
      const module002Worker = await module002GetOcrWorker();
      return await module002Worker.recognize(module002Input);
    } finally {
      module002OcrProgressListener = null;
    }
  });
  module002OcrQueue = module002Task.catch(() => {});
  return module002Task;
}

/** 取消或离开模块时释放 OCR Worker 与 WASM 内存。 */
export async function module002ReleaseOcrWorker() {
  if (!module002OcrWorkerPromise) return;
  try {
    await module002OcrQueue;
    const module002Worker = await module002OcrWorkerPromise;
    await module002Worker.terminate();
  } finally {
    module002OcrWorkerPromise = null;
  }
}

/** 在每个耗时阶段之间统一检查取消信号。 */
function module002ThrowIfAborted(module002Signal) {
  if (module002Signal?.aborted) {
    throw new DOMException("已取消材料解析", "AbortError");
  }
}

/** 用本地 Mammoth 只提取 DOCX 原始文字，不渲染来源 HTML。 */
async function module002ParseDocx(module002File) {
  const module002Mammoth = await import("mammoth/mammoth.browser");
  const module002Result = await module002Mammoth.extractRawText({
    arrayBuffer: await module002File.arrayBuffer(),
  });
  return module002SplitParagraphText(module002Result.value);
}

/** 把扫描 PDF 页渲染为临时画布并交给本地 OCR。 */
async function module002OcrPdfPage(
  module002Page,
  module002Signal,
  module002OnProgress,
) {
  module002ThrowIfAborted(module002Signal);
  const module002Viewport = module002Page.getViewport({ scale: 1.65 });
  const module002Canvas = document.createElement("canvas");
  module002Canvas.width = Math.ceil(module002Viewport.width);
  module002Canvas.height = Math.ceil(module002Viewport.height);
  const module002Context = module002Canvas.getContext("2d", { alpha: false });
  await module002Page.render({
    canvasContext: module002Context,
    viewport: module002Viewport,
  }).promise;
  const module002Result = await module002Recognize(
    module002Canvas,
    module002Signal,
    module002OnProgress,
  );
  module002Canvas.width = 1;
  module002Canvas.height = 1;
  return module002SplitParagraphText(module002Result.data.text);
}

/** 逐页读取 PDF 文本层，仅对无可用文字的页面执行 OCR。 */
async function module002ParsePdf(
  module002File,
  module002Signal,
  module002OnProgress,
) {
  const module002PdfJs = await import("pdfjs-dist/build/pdf.mjs");
  module002PdfJs.GlobalWorkerOptions.workerSrc =
    "/module002/pdf/pdf.worker.min.mjs";
  const module002LoadingTask = module002PdfJs.getDocument({
    data: new Uint8Array(await module002File.arrayBuffer()),
    isEvalSupported: false,
    stopAtErrors: false,
  });
  const module002Pdf = await module002LoadingTask.promise;
  if (module002Pdf.numPages > module002MaximumPdfPages) {
    await module002LoadingTask.destroy();
    throw new Error(`PDF 超过 ${module002MaximumPdfPages} 页保护上限`);
  }
  const module002Paragraphs = [];
  try {
    for (let module002PageNumber = 1; module002PageNumber <= module002Pdf.numPages; module002PageNumber += 1) {
      module002ThrowIfAborted(module002Signal);
      module002OnProgress?.({
        stage: "pdf",
        ratio: (module002PageNumber - 1) / module002Pdf.numPages,
        detail: `正在处理第 ${module002PageNumber}/${module002Pdf.numPages} 页`,
      });
      const module002Page = await module002Pdf.getPage(module002PageNumber);
      const module002TextContent = await module002Page.getTextContent();
      const module002Text = module002TextContent.items
        .map((module002Item) => `${module002Item.str}${module002Item.hasEOL ? "\n" : ""}`)
        .join("");
      const module002TextParagraphs = module002SplitParagraphText(module002Text);
      const module002HasUsefulText = module002Text.replace(/\s/g, "").length >= 40;
      module002Paragraphs.push(
        ...(module002HasUsefulText
          ? module002TextParagraphs
          : await module002OcrPdfPage(
              module002Page,
              module002Signal,
              module002OnProgress,
            )),
      );
      module002Page.cleanup();
    }
  } finally {
    await module002LoadingTask.destroy();
  }
  return module002Paragraphs;
}

/** 对 JPG/JPEG/PNG 执行本地中文 OCR。 */
async function module002ParseImage(
  module002File,
  module002Signal,
  module002OnProgress,
) {
  module002ThrowIfAborted(module002Signal);
  const module002Result = await module002Recognize(
    module002File,
    module002Signal,
    module002OnProgress,
  );
  module002ThrowIfAborted(module002Signal);
  return module002SplitParagraphText(module002Result.data.text);
}

/** 本地解析单个议题材料并返回候选段落和默认第一段。 */
export async function module002ParseSourceFile({
  module002File,
  module002Signal,
  module002OnProgress,
}) {
  const module002FileType = module002GetSupportedFileType(module002File.name);
  if (!module002FileType) throw new Error("仅支持 DOCX、PDF、JPG、JPEG 和 PNG");
  if (module002File.size > module002MaximumFileBytes) {
    throw new Error("单个材料不能超过 20MB");
  }
  module002ThrowIfAborted(module002Signal);
  module002OnProgress?.({ stage: "loading", ratio: 0, detail: "正在读取文件" });
  let module002Paragraphs;
  if (module002FileType === "docx") {
    module002Paragraphs = await module002ParseDocx(module002File);
  } else if (module002FileType === "pdf") {
    module002Paragraphs = await module002ParsePdf(
      module002File,
      module002Signal,
      module002OnProgress,
    );
  } else {
    module002Paragraphs = await module002ParseImage(
      module002File,
      module002Signal,
      module002OnProgress,
    );
  }
  const module002Candidates = module002FindCandidateParagraphs(module002Paragraphs);
  module002OnProgress?.({ stage: "complete", ratio: 1, detail: "解析完成" });
  return {
    fileType: module002FileType,
    paragraphs: module002Paragraphs,
    candidates: module002Candidates,
    selectedText: module002Candidates[0] ?? "",
    needsSelection: module002Candidates.length === 0,
  };
}
