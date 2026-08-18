import { describe, expect, it } from "vitest";
import { module001CreateTestProject } from "../test/module001Fixtures";
import {
  module001LoadProject,
  module001SaveProject,
} from "./module001ProjectRepository";

/** 提供自动保存测试所需的最小内存文件句柄。 */
class Module001MemoryFileHandle {
  constructor(module001Name, module001InitialContent = new Uint8Array()) {
    this.name = module001Name;
    this.module001Content = module001InitialContent;
  }

  /** 返回与浏览器文件句柄一致的不可变 File 快照。 */
  async getFile() {
    return new File([this.module001Content], this.name);
  }

  /** 收集本次写入，并只在 close 后替换原文件。 */
  async createWritable() {
    const module001Chunks = [];
    return {
      write: async (module001Chunk) => module001Chunks.push(module001Chunk),
      close: async () => {
        const module001Blob = new Blob(module001Chunks);
        this.module001Content = new Uint8Array(
          await module001Blob.arrayBuffer(),
        );
      },
      abort: async () => {},
    };
  }
}

/** 提供项目仓库测试所需的最小内存目录句柄。 */
class Module001MemoryDirectoryHandle {
  constructor() {
    this.module001Files = new Map();
  }

  /** 按 File System Access API 语义读取或创建文件句柄。 */
  async getFileHandle(module001Name, module001Options = {}) {
    if (!this.module001Files.has(module001Name)) {
      if (!module001Options.create) {
        throw new DOMException("文件不存在", "NotFoundError");
      }
      this.module001Files.set(
        module001Name,
        new Module001MemoryFileHandle(module001Name),
      );
    }
    return this.module001Files.get(module001Name);
  }

  /** 直接放入测试前置二进制文件。 */
  module001Put(module001Name, module001Content) {
    this.module001Files.set(
      module001Name,
      new Module001MemoryFileHandle(module001Name, module001Content),
    );
  }
}

describe("module001 项目安全保存", () => {
  it("主文件损坏时使用同修订恢复文件", async () => {
    const module001Directory = new Module001MemoryDirectoryHandle();
    module001Directory.module001Put("model.glb", new Uint8Array(128));
    module001Directory.module001Put("preview.png", new Uint8Array([1, 2, 3]));
    const module001Project = module001CreateTestProject();
    await module001SaveProject(module001Directory, module001Project);
    module001Directory.module001Put(
      "project.json",
      new TextEncoder().encode("{broken"),
    );

    const module001Loaded = await module001LoadProject(module001Directory);
    expect(module001Loaded.recovered).toBe(true);
    expect(module001Loaded.project).toEqual(module001Project);
  });

  it("保存清单只记录相对项目文件名", async () => {
    const module001Directory = new Module001MemoryDirectoryHandle();
    module001Directory.module001Put("model.glb", new Uint8Array(128));
    module001Directory.module001Put("preview.png", new Uint8Array([1]));
    await module001SaveProject(
      module001Directory,
      module001CreateTestProject(),
    );
    const module001ManifestFile = await (
      await module001Directory.getFileHandle("manifest.json")
    ).getFile();
    const module001Manifest = JSON.parse(await module001ManifestFile.text());

    expect(module001Manifest.files.map((module001File) => module001File.path))
      .toEqual(["project.json", "model.glb", "preview.png"]);
    expect(
      module001Manifest.files.every(
        (module001File) =>
          !module001File.path.includes("/") &&
          !module001File.path.includes("\\"),
      ),
    ).toBe(true);
  });
});
