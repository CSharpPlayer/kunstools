"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Eye, EyeOff, Focus, RotateCcw, Tags } from "lucide-react";
import {
  Box3,
  Box3Helper,
  Color,
  Vector3,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { module001GetAssetColor } from "../domain/module001ProjectCommands";
import { module001UseStore } from "../state/module001Store";
import {
  module001CreateOverviewCameraPose,
  module001CreatePanFocusCameraPose,
} from "./module001CameraMath";

const module001DracoPath = "/module001/decoders/draco/";
const module001Ktx2Path = "/module001/decoders/basis/";

/**
 * 在对象及其祖先中寻找导入时绑定的稳定 modelNodeId。
 */
function module001FindModelNodeId(
  module001Object,
  module001RuntimeNodeIdByRoot,
) {
  let module001Current = module001Object;

  while (module001Current) {
    const module001ModelNodeId =
      module001RuntimeNodeIdByRoot.get(module001Current);
    if (module001ModelNodeId) {
      return module001ModelNodeId;
    }
    module001Current = module001Current.parent;
  }

  return null;
}

/**
 * 为当前悬停或选中对象创建临时材质副本，避免污染共享原材质。
 */
function module001CreateHighlightedMaterial(
  module001Material,
  module001ColorValue,
  module001Strength,
) {
  const module001Clone = module001Material.clone();
  const module001Color = new Color(module001ColorValue);

  if (module001Clone.color) {
    module001Clone.color.lerp(module001Color, module001Strength * 0.45);
  }

  if (module001Clone.emissive) {
    module001Clone.emissive.copy(module001Color);
    module001Clone.emissiveIntensity = Math.max(
      module001Clone.emissiveIntensity ?? 0,
      module001Strength,
    );
  }

  module001Clone.needsUpdate = true;
  return module001Clone;
}

/**
 * 释放一个 GLTF 场景占用的几何、材质和纹理资源。
 */
function module001DisposeScene(module001Scene) {
  const module001DisposedTextures = new Set();
  const module001DisposedMaterials = new Set();
  const module001DisposedGeometries = new Set();

  module001Scene.traverse((module001Object) => {
    if (
      module001Object.geometry &&
      !module001DisposedGeometries.has(module001Object.geometry)
    ) {
      module001Object.geometry.dispose();
      module001DisposedGeometries.add(module001Object.geometry);
    }

    const module001Materials = Array.isArray(module001Object.material)
      ? module001Object.material
      : module001Object.material
        ? [module001Object.material]
        : [];

    module001Materials.forEach((module001Material) => {
      if (module001DisposedMaterials.has(module001Material)) {
        return;
      }

      Object.values(module001Material).forEach((module001Value) => {
        if (
          module001Value?.isTexture &&
          !module001DisposedTextures.has(module001Value)
        ) {
          module001Value.dispose();
          module001DisposedTextures.add(module001Value);
        }
      });
      module001Material.dispose();
      module001DisposedMaterials.add(module001Material);
    });
  });
}

/**
 * 为全部可见资产节点生成固定在模型中心的稳定标签。
 */
function Module001Labels({
  module001Project,
  module001RuntimeNodes,
  module001Enabled,
}) {
  const module001VisibleLabels = useMemo(() => {
    if (!module001Enabled) return [];

    const module001AssetsById = new Map(
      module001Project.assets.map((module001Asset) => [
        module001Asset.assetId,
        module001Asset,
      ]),
    );
    const module001CategoriesById = new Map(
      module001Project.categories.map((module001Category) => [
        module001Category.categoryId,
        module001Category.name,
      ]),
    );

    return module001Project.modelNodes.flatMap((module001Node) => {
      if (!module001Node.assetId || !module001Node.visible) return [];

      const module001RuntimeRoot = module001RuntimeNodes.get(
        module001Node.modelNodeId,
      );
      const module001Asset = module001AssetsById.get(module001Node.assetId);
      if (!module001RuntimeRoot || !module001Asset) return [];

      const module001Box = new Box3().setFromObject(module001RuntimeRoot);
      if (module001Box.isEmpty()) return [];

      return [
        {
          key: module001Node.modelNodeId,
          position: module001Box.getCenter(new Vector3()).toArray(),
          assetName: module001Asset.name,
          assetCode: module001Asset.code,
          category:
            module001CategoriesById.get(module001Asset.categoryId) ?? "",
        },
      ];
    });
  }, [
    module001Enabled,
    module001Project.assets,
    module001Project.categories,
    module001Project.modelNodes,
    module001RuntimeNodes,
  ]);

  if (!module001Enabled) {
    return null;
  }

  return module001VisibleLabels.map((module001Label) => (
    <Html
      center
      distanceFactor={10}
      key={module001Label.key}
      position={module001Label.position}
      style={{ pointerEvents: "none" }}
      zIndexRange={[20, 0]}
    >
      <div className="module001SceneLabel">
        <strong>{module001Label.assetName}</strong>
        <span>{module001Label.assetCode}</span>
        <small>{module001Label.category}</small>
      </div>
    </Html>
  ));
}

/**
 * 加载模型、绑定稳定节点、处理交互高亮并控制观察相机。
 */
function Module001SceneContent({
  module001ModelUrl,
  module001Project,
  module001InitializationRows,
  module001FocusedModelNodeId,
  module001OnModelNodeClick,
  module001RegisterApi,
  module001OnContextLost,
}) {
  const {
    camera: module001Camera,
    gl: module001Renderer,
    scene: module001RootScene,
  } = useThree();
  const module001ControlsRef = useRef(null);
  const module001FocusRef = useRef(null);
  const module001HomeRef = useRef(null);
  const module001Ktx2LoaderRef = useRef(null);
  const module001DracoLoaderRef = useRef(null);
  const module001Gltf = useLoader(
    GLTFLoader,
    module001ModelUrl,
    (module001Loader) => {
      const module001DracoLoader = new DRACOLoader();
      module001DracoLoader.setDecoderPath(module001DracoPath);
      module001DracoLoader.preload();
      module001Loader.setDRACOLoader(module001DracoLoader);
      module001DracoLoaderRef.current = module001DracoLoader;

      const module001Ktx2Loader = new KTX2Loader();
      module001Ktx2Loader
        .setTranscoderPath(module001Ktx2Path)
        .detectSupport(module001Renderer);
      module001Loader.setKTX2Loader(module001Ktx2Loader);
      module001Ktx2LoaderRef.current = module001Ktx2Loader;
      module001Loader.setMeshoptDecoder(MeshoptDecoder);
    },
  );
  const module001RuntimeNodes = useMemo(() => {
    const module001Map = new Map();

    module001Project.modelNodes.forEach((module001Node) => {
      const module001Root =
        module001Gltf.scene.children[module001Node.sceneNodeOrdinal];

      if (module001Root) {
        module001Map.set(module001Node.modelNodeId, module001Root);
      }
    });
    return module001Map;
  }, [module001Gltf.scene, module001Project.modelNodes]);
  const module001RuntimeNodeIdByRoot = useMemo(() => {
    const module001Map = new WeakMap();
    module001RuntimeNodes.forEach((module001Root, module001ModelNodeId) => {
      module001Map.set(module001Root, module001ModelNodeId);
    });
    return module001Map;
  }, [module001RuntimeNodes]);
  const module001HoverAssetId = module001UseStore(
    (module001State) => module001State.hoverAssetId,
  );
  const module001SelectedAssetId = module001UseStore(
    (module001State) => module001State.selectedAssetId,
  );
  const module001SetHoverAssetId = module001UseStore(
    (module001State) => module001State.setHoverAssetId,
  );
  const module001SetSelectedAssetId = module001UseStore(
    (module001State) => module001State.setSelectedAssetId,
  );

  /** 将相机平滑移动到一个或多个运行时顶层节点。 */
  const module001FocusNodes = useCallback(
    (module001NodeIds) => {
      const module001Box = new Box3();
      let module001HasContent = false;

      module001NodeIds.forEach((module001NodeId) => {
        const module001Root = module001RuntimeNodes.get(module001NodeId);

        if (module001Root) {
          module001Box.expandByObject(module001Root);
          module001HasContent = true;
        }
      });

      if (!module001HasContent || module001Box.isEmpty()) {
        return;
      }

      const module001CurrentTarget =
        module001ControlsRef.current?.target ?? new Vector3();
      module001FocusRef.current = module001CreatePanFocusCameraPose({
        module001TargetBox: module001Box,
        module001CurrentPosition: module001Camera.position,
        module001CurrentTarget,
      });
    },
    [module001Camera.position, module001RuntimeNodes],
  );

  /** 将相机恢复到首次适配全场景的位置。 */
  const module001ResetCamera = useCallback(() => {
    if (module001HomeRef.current) {
      module001FocusRef.current = {
        target: module001HomeRef.current.target.clone(),
        position: module001HomeRef.current.position.clone(),
      };
    }
  }, []);

  useEffect(() => {
    const module001SceneBox = new Box3().setFromObject(module001Gltf.scene);

    if (!module001SceneBox.isEmpty()) {
      const module001OverviewPose =
        module001CreateOverviewCameraPose(module001SceneBox);

      module001HomeRef.current = {
        target: module001OverviewPose.target.clone(),
        position: module001OverviewPose.position.clone(),
      };
      module001Camera.position.copy(module001OverviewPose.position);
      module001ControlsRef.current?.target.copy(module001OverviewPose.target);
      module001ControlsRef.current?.update();
    }
  }, [module001Camera, module001Gltf.scene]);

  useEffect(() => {
    module001Project.modelNodes.forEach((module001Node) => {
      const module001Root = module001RuntimeNodes.get(module001Node.modelNodeId);

      if (module001Root) {
        module001Root.visible =
          module001Node.visible &&
          (module001Node.isAssetObject ||
            module001Project.sceneSettings.showSceneObjects);
      }
    });
  }, [
    module001Project.modelNodes,
    module001Project.sceneSettings.showSceneObjects,
    module001RuntimeNodes,
  ]);

  useEffect(() => {
    const module001DesiredRoots = new Map();
    const module001SelectedAsset = module001Project.assets.find(
      (module001Asset) =>
        module001Asset.assetId === module001SelectedAssetId,
    );
    const module001HoveredAsset = module001Project.assets.find(
      (module001Asset) => module001Asset.assetId === module001HoverAssetId,
    );

    module001SelectedAsset?.modelNodeIds.forEach((module001NodeId) => {
      module001DesiredRoots.set(module001NodeId, {
        color: module001GetAssetColor(module001Project, module001SelectedAsset),
        strength: 0.45,
      });
    });
    module001HoveredAsset?.modelNodeIds.forEach((module001NodeId) => {
      module001DesiredRoots.set(module001NodeId, {
        color: module001GetAssetColor(module001Project, module001HoveredAsset),
        strength: 0.72,
      });
    });

    module001InitializationRows
      ?.filter((module001Row) => module001Row.selected)
      .forEach((module001Row) => {
        module001DesiredRoots.set(module001Row.modelNodeId, {
          color: module001Row.color,
          strength:
            module001Row.modelNodeId === module001FocusedModelNodeId
              ? 0.82
              : 0.4,
        });
      });

    if (
      module001FocusedModelNodeId &&
      !module001DesiredRoots.has(module001FocusedModelNodeId)
    ) {
      module001DesiredRoots.set(module001FocusedModelNodeId, {
        color: "#f59e0b",
        strength: 0.72,
      });
    }

    const module001Restorations = [];
    const module001Helpers = [];

    module001DesiredRoots.forEach(
      (module001Highlight, module001NodeId) => {
        const module001Root = module001RuntimeNodes.get(module001NodeId);

        if (!module001Root) {
          return;
        }

        module001Root.traverse((module001Object) => {
          if (!module001Object.isMesh || !module001Object.material) {
            return;
          }

          const module001OriginalMaterial = module001Object.material;
          const module001OriginalMaterials = Array.isArray(
            module001OriginalMaterial,
          )
            ? module001OriginalMaterial
            : [module001OriginalMaterial];
          const module001HighlightedMaterials = module001OriginalMaterials.map(
            (module001Material) =>
              module001CreateHighlightedMaterial(
                module001Material,
                module001Highlight.color,
                module001Highlight.strength,
              ),
          );

          module001Object.material = Array.isArray(module001OriginalMaterial)
            ? module001HighlightedMaterials
            : module001HighlightedMaterials[0];
          module001Restorations.push({
            object: module001Object,
            originalMaterial: module001OriginalMaterial,
            highlightedMaterials: module001HighlightedMaterials,
          });
        });

        const module001Box = new Box3().setFromObject(module001Root);

        if (!module001Box.isEmpty()) {
          const module001Helper = new Box3Helper(
            module001Box,
            new Color(module001Highlight.color),
          );
          module001Gltf.scene.add(module001Helper);
          module001Helpers.push(module001Helper);
        }
      },
    );

    return () => {
      module001Restorations.forEach(
        ({ object, originalMaterial, highlightedMaterials }) => {
          object.material = originalMaterial;
          highlightedMaterials.forEach((module001Material) =>
            module001Material.dispose(),
          );
        },
      );
      module001Helpers.forEach((module001Helper) => {
        module001Gltf.scene.remove(module001Helper);
        module001Helper.geometry.dispose();
        module001Helper.material.dispose();
      });
    };
  }, [
    module001FocusedModelNodeId,
    module001Gltf.scene,
    module001HoverAssetId,
    module001InitializationRows,
    module001Project,
    module001RuntimeNodes,
    module001SelectedAssetId,
  ]);

  useEffect(() => {
    if (module001SelectedAssetId) {
      const module001Asset = module001Project.assets.find(
        (module001Item) =>
          module001Item.assetId === module001SelectedAssetId,
      );
      if (module001Asset) {
        module001FocusNodes(module001Asset.modelNodeIds);
      }
    }
  }, [
    module001FocusNodes,
    module001Project.assets,
    module001SelectedAssetId,
  ]);

  useEffect(() => {
    if (module001FocusedModelNodeId) {
      module001FocusNodes([module001FocusedModelNodeId]);
    }
  }, [module001FocusNodes, module001FocusedModelNodeId]);

  useEffect(() => {
    module001RegisterApi({
      reset: module001ResetCamera,
      focusSelected() {
        if (module001SelectedAssetId) {
          const module001Asset = module001Project.assets.find(
            (module001Item) =>
              module001Item.assetId === module001SelectedAssetId,
          );
          if (module001Asset) {
            module001FocusNodes(module001Asset.modelNodeIds);
          }
        }
      },
      captureCamera() {
        module001Renderer.render(module001RootScene, module001Camera);
        return {
          position: module001Camera.position.toArray(),
          target:
            module001ControlsRef.current?.target.toArray() ?? [0, 0, 0],
          canvas: module001Renderer.domElement,
        };
      },
    });
    return () => module001RegisterApi(null);
  }, [
    module001Camera,
    module001FocusNodes,
    module001Project.assets,
    module001RegisterApi,
    module001Renderer,
    module001RootScene,
    module001ResetCamera,
    module001SelectedAssetId,
  ]);

  useEffect(() => {
    const module001Canvas = module001Renderer.domElement;

    /** 在 WebGL 上下文丢失时暂停并展示可恢复错误。 */
    function module001HandleContextLost(module001Event) {
      module001Event.preventDefault();
      module001OnContextLost(true);
    }

    /** 在浏览器恢复 WebGL 上下文后移除错误状态。 */
    function module001HandleContextRestored() {
      module001OnContextLost(false);
    }

    module001Canvas.addEventListener(
      "webglcontextlost",
      module001HandleContextLost,
    );
    module001Canvas.addEventListener(
      "webglcontextrestored",
      module001HandleContextRestored,
    );
    return () => {
      module001Canvas.removeEventListener(
        "webglcontextlost",
        module001HandleContextLost,
      );
      module001Canvas.removeEventListener(
        "webglcontextrestored",
        module001HandleContextRestored,
      );
    };
  }, [module001OnContextLost, module001Renderer.domElement]);

  useEffect(
    () => () => {
      module001DracoLoaderRef.current?.dispose();
      module001Ktx2LoaderRef.current?.dispose();
      module001DisposeScene(module001Gltf.scene);
      useLoader.clear(GLTFLoader, module001ModelUrl);
    },
    [module001Gltf.scene, module001ModelUrl],
  );

  useFrame((_, module001Delta) => {
    const module001Focus = module001FocusRef.current;

    if (!module001Focus || !module001ControlsRef.current) {
      return;
    }

    const module001Factor = 1 - Math.exp(-5.5 * module001Delta);
    module001Camera.position.lerp(module001Focus.position, module001Factor);
    module001ControlsRef.current.target.lerp(
      module001Focus.target,
      module001Factor,
    );
    module001ControlsRef.current.update();

    if (
      module001Camera.position.distanceTo(module001Focus.position) < 0.015 &&
      module001ControlsRef.current.target.distanceTo(module001Focus.target) <
        0.015
    ) {
      module001FocusRef.current = null;
    }
  });

  /** 根据指针对象更新临时悬停资产。 */
  function module001HandlePointerMove(module001Event) {
    const module001NodeId = module001FindModelNodeId(
      module001Event.object,
      module001RuntimeNodeIdByRoot,
    );
    const module001Node = module001Project.modelNodes.find(
      (module001Item) => module001Item.modelNodeId === module001NodeId,
    );

    if (module001Node?.assetId) {
      module001Event.stopPropagation();
      module001SetHoverAssetId(module001Node.assetId);
    }
  }

  /** 根据点击对象完成资产选中或初始化节点定位。 */
  function module001HandleClick(module001Event) {
    const module001NodeId = module001FindModelNodeId(
      module001Event.object,
      module001RuntimeNodeIdByRoot,
    );
    const module001Node = module001Project.modelNodes.find(
      (module001Item) => module001Item.modelNodeId === module001NodeId,
    );

    if (!module001Node) {
      return;
    }

    module001Event.stopPropagation();
    module001OnModelNodeClick?.(module001Node.modelNodeId);
    if (module001Node.assetId) {
      module001SetSelectedAssetId(module001Node.assetId);
    }
  }

  return (
    <>
      <ambientLight intensity={1.15} />
      <hemisphereLight intensity={1.1} />
      <directionalLight intensity={2.1} position={[8, 12, 6]} />
      <primitive
        object={module001Gltf.scene}
        onClick={module001HandleClick}
        onPointerMissed={() => module001SetSelectedAssetId(null)}
        onPointerMove={module001HandlePointerMove}
        onPointerOut={() => module001SetHoverAssetId(null)}
      />
      <Module001Labels
        module001Enabled={
          module001Project.initializationStatus === "ready" &&
          module001Project.sceneSettings.showLabels
        }
        module001Project={module001Project}
        module001RuntimeNodes={module001RuntimeNodes}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.085}
        makeDefault
        maxDistance={100000}
        minDistance={0.05}
        ref={module001ControlsRef}
        screenSpacePanning
      />
    </>
  );
}

/**
 * 提供模块三维视口、观察工具和本地 model.glb 生命周期。
 */
export default function Module001SceneCanvas({
  module001InitializationRows = null,
  module001FocusedModelNodeId = null,
  module001OnModelNodeClick = null,
  module001OnSceneApi = null,
}) {
  const module001Project = module001UseStore(
    (module001State) => module001State.currentProject,
  );
  const module001ProjectDirectory = module001UseStore(
    (module001State) => module001State.projectDirectory,
  );
  const module001RunProjectCommand = module001UseStore(
    (module001State) => module001State.runProjectCommand,
  );
  const module001SelectedAssetId = module001UseStore(
    (module001State) => module001State.selectedAssetId,
  );
  const [module001ModelUrl, setModule001ModelUrl] = useState(null);
  const [module001LoadError, setModule001LoadError] = useState(null);
  const [module001ContextLost, setModule001ContextLost] = useState(false);
  const module001SceneApiRef = useRef(null);

  useEffect(() => {
    let module001CurrentUrl = null;
    let module001Cancelled = false;

    /** 从用户授权目录取得模型 File 并建立短生命周期对象网址。 */
    async function module001OpenModel() {
      try {
        const module001ModelHandle =
          await module001ProjectDirectory.getFileHandle("model.glb");
        const module001ModelFile = await module001ModelHandle.getFile();
        module001CurrentUrl = URL.createObjectURL(module001ModelFile);
        if (!module001Cancelled) {
          setModule001ModelUrl(module001CurrentUrl);
          setModule001LoadError(null);
        }
      } catch (module001Error) {
        if (!module001Cancelled) {
          setModule001LoadError(
            module001Error instanceof Error
              ? module001Error.message
              : "模型文件无法读取",
          );
        }
      }
    }

    module001OpenModel();
    return () => {
      module001Cancelled = true;
      if (module001CurrentUrl) {
        URL.revokeObjectURL(module001CurrentUrl);
      }
      setModule001ModelUrl(null);
    };
  }, [module001ProjectDirectory]);

  /** 注册场景相机 API 并转发给工作区。 */
  const module001RegisterApi = useCallback(
    (module001Api) => {
      module001SceneApiRef.current = module001Api;
      module001OnSceneApi?.(module001Api);
    },
    [module001OnSceneApi],
  );

  /** 切换场景辅助对象显示状态。 */
  function module001ToggleSceneObjects() {
    module001RunProjectCommand("切换场景对象显示", (module001Draft) => {
      module001Draft.sceneSettings.showSceneObjects =
        !module001Draft.sceneSettings.showSceneObjects;
    });
  }

  /** 切换资产标签显示状态。 */
  function module001ToggleLabels() {
    module001RunProjectCommand("切换资产标签显示", (module001Draft) => {
      module001Draft.sceneSettings.showLabels =
        !module001Draft.sceneSettings.showLabels;
    });
  }

  if (module001LoadError) {
    return (
      <div className="module001SceneState" role="alert">
        <strong>模型读取失败</strong>
        <span>{module001LoadError}</span>
      </div>
    );
  }

  if (!module001ModelUrl) {
    return (
      <div className="module001SceneState" role="status">
        <span className="module001Spin" />
        <span>正在读取本地 GLB</span>
      </div>
    );
  }

  return (
    <div className="module001SceneCanvas">
      <Canvas
        camera={{ fov: 42, near: 0.01, far: 1000000 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl: module001Renderer }) => {
          module001Renderer.setClearColor("#eef3f8");
        }}
      >
        <Suspense
          fallback={
            <Html center>
              <div className="module001SceneLoading">正在解析模型</div>
            </Html>
          }
        >
          <Module001SceneContent
            module001FocusedModelNodeId={module001FocusedModelNodeId}
            module001InitializationRows={module001InitializationRows}
            module001ModelUrl={module001ModelUrl}
            module001OnContextLost={setModule001ContextLost}
            module001OnModelNodeClick={module001OnModelNodeClick}
            module001Project={module001Project}
            module001RegisterApi={module001RegisterApi}
          />
        </Suspense>
      </Canvas>
      <div className="module001SceneTools" aria-label="三维观察工具">
        <button
          aria-label="复位视角"
          className="module001IconButton"
          onClick={() => module001SceneApiRef.current?.reset()}
          title="复位视角"
          type="button"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="聚焦选中资产"
          className="module001IconButton"
          disabled={!module001SelectedAssetId}
          onClick={() => module001SceneApiRef.current?.focusSelected()}
          title="聚焦选中资产"
          type="button"
        >
          <Focus size={16} aria-hidden="true" />
        </button>
        {module001Project.initializationStatus === "ready" ? (
          <>
            <button
              aria-pressed={module001Project.sceneSettings.showLabels}
              aria-label={
                module001Project.sceneSettings.showSceneObjects
                  ? "隐藏场景对象"
                  : "显示场景对象"
              }
              className={`module001IconButton ${
                module001Project.sceneSettings.showLabels
                  ? "module001SceneToggleActive"
                  : ""
              }`}
              onClick={module001ToggleSceneObjects}
              title="场景对象显示/隐藏"
              type="button"
            >
              {module001Project.sceneSettings.showSceneObjects ? (
                <Eye size={16} aria-hidden="true" />
              ) : (
                <EyeOff size={16} aria-hidden="true" />
              )}
            </button>
            <button
              aria-label={
                module001Project.sceneSettings.showLabels
                  ? "隐藏资产标签"
                  : "显示资产标签"
              }
              className="module001IconButton"
              onClick={module001ToggleLabels}
              title="资产标签显示/隐藏"
              type="button"
            >
              <Tags size={16} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      {module001ContextLost ? (
        <div className="module001SceneContextError" role="alert">
          WebGL 上下文已中断，正在等待浏览器恢复。
        </div>
      ) : null}
    </div>
  );
}
