import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  module001CreateOverviewCameraPose,
  module001CreatePanFocusCameraPose,
} from "./module001CameraMath";

describe("module001 三维相机位姿", () => {
  it("首次打开采用明显高于水平偏移的俯视角", () => {
    const module001Box = new Box3(
      new Vector3(-5, 0, -4),
      new Vector3(5, 2, 4),
    );
    const module001Pose = module001CreateOverviewCameraPose(module001Box);
    const module001Offset = module001Pose.position
      .clone()
      .sub(module001Pose.target);
    const module001HorizontalOffset = Math.hypot(
      module001Offset.x,
      module001Offset.z,
    );

    expect(module001Offset.y).toBeGreaterThan(module001HorizontalOffset * 2);
  });

  it("选中资产只平移视角并保持观察距离", () => {
    const module001CurrentPosition = new Vector3(18, 24, 18);
    const module001CurrentTarget = new Vector3(2, 1, 2);
    const module001CurrentDistance = module001CurrentPosition.distanceTo(
      module001CurrentTarget,
    );
    const module001Pose = module001CreatePanFocusCameraPose({
      module001TargetBox: new Box3(
        new Vector3(30, 0, 30),
        new Vector3(34, 4, 34),
      ),
      module001CurrentPosition,
      module001CurrentTarget,
    });

    expect(module001Pose.position.distanceTo(module001Pose.target)).toBeCloseTo(
      module001CurrentDistance,
      8,
    );
    expect(module001Pose.target.toArray()).toEqual([32, 2, 32]);
  });
});

