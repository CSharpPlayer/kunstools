import { module001WriteFile } from "../workspace/module001FileSystem";

/**
 * 将当前 WebGL 画布在单次显式渲染后转换成 PNG，不长期保留绘图缓冲。
 */
function module001CanvasToPng(module001Canvas) {
  return new Promise((module001Resolve, module001Reject) => {
    module001Canvas.toBlob(
      (module001Blob) => {
        if (module001Blob) {
          module001Resolve(module001Blob);
        } else {
          module001Reject(new Error("当前三维视角无法生成封面"));
        }
      },
      "image/png",
      0.92,
    );
  });
}

/**
 * 保存当前相机位姿和项目 preview.png。
 */
export async function module001SaveCurrentViewAsCover({
  module001SceneApi,
  module001ProjectDirectory,
}) {
  if (!module001SceneApi) {
    throw new Error("三维场景尚未准备完成");
  }

  const module001Capture = module001SceneApi.captureCamera();
  const module001Png = await module001CanvasToPng(module001Capture.canvas);
  await module001WriteFile(
    module001ProjectDirectory,
    "preview.png",
    module001Png,
  );

  return {
    position: module001Capture.position,
    target: module001Capture.target,
  };
}
