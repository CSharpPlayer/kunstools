import { Vector3 } from "three";

const module001OverviewDirection = new Vector3(0.55, 1.75, 0.55).normalize();

/**
 * 为首次打开模型生成偏高的俯视观察位姿，并完整容纳场景。
 */
export function module001CreateOverviewCameraPose(module001SceneBox) {
  const module001Target = module001SceneBox.getCenter(new Vector3());
  const module001Size = module001SceneBox.getSize(new Vector3());
  const module001Radius = Math.max(
    module001Size.x,
    module001Size.y,
    module001Size.z,
    1,
  );

  return {
    target: module001Target,
    position: module001Target
      .clone()
      .add(module001OverviewDirection.clone().multiplyScalar(module001Radius * 2.2)),
  };
}

/**
 * 把目标平移到选中资产中心，同时保持当前方向和观察距离不变。
 */
export function module001CreatePanFocusCameraPose({
  module001TargetBox,
  module001CurrentPosition,
  module001CurrentTarget,
}) {
  const module001Target = module001TargetBox.getCenter(new Vector3());
  const module001Offset = module001CurrentPosition
    .clone()
    .sub(module001CurrentTarget);

  if (module001Offset.lengthSq() < 0.0001) {
    module001Offset.copy(module001OverviewDirection).multiplyScalar(2);
  }

  return {
    target: module001Target,
    position: module001Target.clone().add(module001Offset),
  };
}

