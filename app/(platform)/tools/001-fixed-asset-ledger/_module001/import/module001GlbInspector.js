import { module001CreateId } from "../domain/module001Factories";

export const module001MaximumGlbBytes = 500 * 1024 * 1024;
const module001MaximumGlbJsonBytes = 32 * 1024 * 1024;

const module001SupportedRequiredExtensions = new Set([
  "EXT_mesh_gpu_instancing",
  "EXT_meshopt_compression",
  "EXT_texture_avif",
  "EXT_texture_webp",
  "KHR_draco_mesh_compression",
  "KHR_lights_punctual",
  "KHR_materials_anisotropy",
  "KHR_materials_clearcoat",
  "KHR_materials_dispersion",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_iridescence",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_unlit",
  "KHR_materials_variants",
  "KHR_materials_volume",
  "KHR_mesh_quantization",
  "KHR_texture_basisu",
  "KHR_texture_transform",
]);

/**
 * 读取 GLB 的指定字节范围，避免检查阶段载入整个大型模型。
 */
async function module001ReadFileRange(
  module001File,
  module001Start,
  module001End,
) {
  return module001File.slice(module001Start, module001End).arrayBuffer();
}

/**
 * 递归统计节点及后代中的网格数量，并防止损坏文件形成循环引用。
 */
function module001CountDescendantMeshes(
  module001NodeIndex,
  module001Nodes,
  module001Visited = new Set(),
) {
  if (module001Visited.has(module001NodeIndex)) {
    throw new Error("GLB 节点层级存在循环引用");
  }

  const module001Node = module001Nodes[module001NodeIndex];

  if (!module001Node) {
    throw new Error("GLB 节点引用超出有效范围");
  }

  const module001NextVisited = new Set(module001Visited);
  module001NextVisited.add(module001NodeIndex);
  let module001MeshCount = Number.isInteger(module001Node.mesh) ? 1 : 0;

  for (const module001ChildIndex of module001Node.children ?? []) {
    module001MeshCount += module001CountDescendantMeshes(
      module001ChildIndex,
      module001Nodes,
      module001NextVisited,
    );
  }

  return module001MeshCount;
}

/**
 * 检查自包含 GLB 的头部、JSON 块、必需扩展和顶层候选对象。
 */
export async function module001InspectGlb(module001File) {
  if (!module001File) {
    throw new Error("请选择一个 GLB 文件");
  }

  if (!module001File.name.toLowerCase().endsWith(".glb")) {
    throw new Error("仅支持自包含的 .glb 文件");
  }

  if (module001File.size < 20) {
    throw new Error("GLB 文件过小或内容不完整");
  }

  if (module001File.size > module001MaximumGlbBytes) {
    throw new Error("GLB 超过 500 MB 目标上限");
  }

  const module001HeaderBuffer = await module001ReadFileRange(
    module001File,
    0,
    20,
  );
  const module001Header = new DataView(module001HeaderBuffer);
  const module001Magic = new TextDecoder("ascii").decode(
    new Uint8Array(module001HeaderBuffer, 0, 4),
  );
  const module001Version = module001Header.getUint32(4, true);
  const module001DeclaredLength = module001Header.getUint32(8, true);
  const module001JsonLength = module001Header.getUint32(12, true);
  const module001JsonType = module001Header.getUint32(16, true);

  if (module001Magic !== "glTF" || module001Version !== 2) {
    throw new Error("文件头不是有效的 GLB 2.0");
  }

  if (module001DeclaredLength !== module001File.size) {
    throw new Error("GLB 声明大小与实际文件大小不一致");
  }

  if (module001JsonType !== 0x4e4f534a || module001JsonLength <= 0) {
    throw new Error("GLB 缺少有效的 JSON 描述块");
  }

  if (module001JsonLength > module001MaximumGlbJsonBytes) {
    throw new Error("GLB 的 JSON 描述块异常过大");
  }

  if (20 + module001JsonLength > module001File.size) {
    throw new Error("GLB JSON 描述块超出文件范围");
  }

  const module001JsonBuffer = await module001ReadFileRange(
    module001File,
    20,
    20 + module001JsonLength,
  );
  let module001Document;

  try {
    const module001JsonText = new TextDecoder("utf-8")
      .decode(module001JsonBuffer)
      .replace(/[\u0000\u0020]+$/g, "");
    module001Document = JSON.parse(module001JsonText);
  } catch {
    throw new Error("GLB 的 JSON 描述块已损坏");
  }

  if (module001Document?.asset?.version !== "2.0") {
    throw new Error("GLB JSON 未声明有效的 glTF 2.0 版本");
  }

  const module001ExternalUris = [
    ...(module001Document.buffers ?? []),
    ...(module001Document.images ?? []),
  ]
    .map((module001Resource) => module001Resource?.uri)
    .filter(
      (module001Uri) =>
        typeof module001Uri === "string" &&
        !module001Uri.startsWith("data:"),
    );
  if (module001ExternalUris.length > 0) {
    throw new Error("GLB 引用了外部文件，仅支持完全自包含的模型");
  }

  const module001Scenes = Array.isArray(module001Document.scenes)
    ? module001Document.scenes
    : [];
  const module001Nodes = Array.isArray(module001Document.nodes)
    ? module001Document.nodes
    : [];
  const module001DefaultSceneIndex = Number.isInteger(module001Document.scene)
    ? module001Document.scene
    : 0;
  const module001DefaultScene = module001Scenes[module001DefaultSceneIndex];

  if (!module001DefaultScene || !Array.isArray(module001DefaultScene.nodes)) {
    throw new Error("GLB 没有可用的默认场景");
  }

  if (
    new Set(module001DefaultScene.nodes).size !==
    module001DefaultScene.nodes.length
  ) {
    throw new Error("GLB 默认场景包含重复的顶层节点引用");
  }

  const module001ExtensionsRequired = Array.isArray(
    module001Document.extensionsRequired,
  )
    ? module001Document.extensionsRequired
    : [];
  const module001UnsupportedExtensions = module001ExtensionsRequired.filter(
    (module001Extension) =>
      !module001SupportedRequiredExtensions.has(module001Extension),
  );

  if (module001UnsupportedExtensions.length > 0) {
    throw new Error(
      `GLB 使用了暂不支持的必需扩展：${module001UnsupportedExtensions.join("、")}`,
    );
  }

  const module001ModelNodes = module001DefaultScene.nodes.map(
    (module001TopLevelIndex, module001SceneNodeOrdinal) => {
      const module001Node = module001Nodes[module001TopLevelIndex];

      if (!module001Node) {
        throw new Error("默认场景引用了不存在的顶层节点");
      }

      const module001MeshDescendantCount = module001CountDescendantMeshes(
        module001TopLevelIndex,
        module001Nodes,
      );
      const module001SourceName =
        typeof module001Node.name === "string" ? module001Node.name : "";
      const module001DisplayName =
        module001SourceName.trim() || `未命名对象 ${module001SceneNodeOrdinal + 1}`;

      return {
        modelNodeId: module001CreateId(),
        sourceName: module001SourceName,
        displayPath: `顶层对象 ${module001SceneNodeOrdinal + 1} / ${module001DisplayName}`,
        topLevelIndex: module001TopLevelIndex,
        sceneNodeOrdinal: module001SceneNodeOrdinal,
        meshDescendantCount: module001MeshDescendantCount,
        isCandidate: module001MeshDescendantCount > 0,
        isAssetObject: false,
        visible: true,
        assetId: null,
      };
    },
  );

  return {
    sceneCount: module001Scenes.length,
    defaultSceneIndex: module001DefaultSceneIndex,
    topLevelNodeCount: module001ModelNodes.length,
    candidateNodeCount: module001ModelNodes.filter(
      (module001Node) => module001Node.isCandidate,
    ).length,
    modelNodes: module001ModelNodes,
    extensionsUsed: Array.isArray(module001Document.extensionsUsed)
      ? module001Document.extensionsUsed
      : [],
    extensionsRequired: module001ExtensionsRequired,
    hasDraco: module001ExtensionsRequired.includes("KHR_draco_mesh_compression"),
    hasMeshopt: module001ExtensionsRequired.includes("EXT_meshopt_compression"),
    hasKtx2: module001ExtensionsRequired.includes("KHR_texture_basisu"),
  };
}
