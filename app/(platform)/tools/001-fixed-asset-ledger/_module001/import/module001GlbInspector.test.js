import { describe, expect, it } from "vitest";
import { module001InspectGlb } from "./module001GlbInspector";

/** 生成只含 JSON 块的最小合法 GLB 2.0 测试文件。 */
function module001CreateGlbFile(
  module001Document,
  module001Name = "fixture.glb",
) {
  const module001Encoder = new TextEncoder();
  const module001Json = module001Encoder.encode(JSON.stringify(module001Document));
  const module001Padding = (4 - (module001Json.length % 4)) % 4;
  const module001JsonLength = module001Json.length + module001Padding;
  const module001Bytes = new Uint8Array(20 + module001JsonLength);
  const module001View = new DataView(module001Bytes.buffer);
  module001Bytes.set(module001Encoder.encode("glTF"), 0);
  module001View.setUint32(4, 2, true);
  module001View.setUint32(8, module001Bytes.length, true);
  module001View.setUint32(12, module001JsonLength, true);
  module001View.setUint32(16, 0x4e4f534a, true);
  module001Bytes.set(module001Json, 20);
  module001Bytes.fill(0x20, 20 + module001Json.length);
  return new File([module001Bytes], module001Name, {
    type: "model/gltf-binary",
  });
}

describe("module001 GLB 检查", () => {
  it("只把包含后代网格的顶层节点识别为候选对象", async () => {
    const module001File = module001CreateGlbFile({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0, 1] }],
      nodes: [
        { name: "资产根", children: [2] },
        { name: "场景对象" },
        { name: "网格", mesh: 0 },
      ],
      meshes: [{ primitives: [] }],
    });
    const module001Inspection = await module001InspectGlb(module001File);

    expect(module001Inspection.topLevelNodeCount).toBe(2);
    expect(module001Inspection.candidateNodeCount).toBe(1);
    expect(module001Inspection.modelNodes[0].meshDescendantCount).toBe(1);
    expect(module001Inspection.modelNodes[1].isCandidate).toBe(false);
  });

  it("拒绝未知必需扩展和伪装扩展名", async () => {
    const module001UnknownExtension = module001CreateGlbFile({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      extensionsRequired: ["VENDOR_unknown_required"],
    });
    await expect(module001InspectGlb(module001UnknownExtension)).rejects.toThrow(
      "暂不支持",
    );

    const module001WrongName = module001CreateGlbFile(
      { asset: { version: "2.0" }, scenes: [{ nodes: [] }], nodes: [] },
      "fixture.gltf",
    );
    await expect(module001InspectGlb(module001WrongName)).rejects.toThrow(
      "仅支持",
    );
  });
});
