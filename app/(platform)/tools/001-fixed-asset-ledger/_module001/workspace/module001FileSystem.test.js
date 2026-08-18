import { describe, expect, it } from "vitest";
import { module001CopyFileStream } from "./module001FileSystem";

/** 创建只统计字节、不保留大型内容的可写文件测试替身。 */
function module001CreateCountingTarget() {
  const module001State = {
    aborted: false,
    closed: false,
    writtenBytes: 0,
    writeCount: 0,
  };
  const module001FileHandle = {
    async createWritable() {
      return {
        async write(module001Chunk) {
          module001State.writtenBytes += module001Chunk.byteLength;
          module001State.writeCount += 1;
        },
        async close() {
          module001State.closed = true;
        },
        async abort() {
          module001State.aborted = true;
        },
      };
    },
  };

  return {
    state: module001State,
    directory: {
      async getFileHandle() {
        return module001FileHandle;
      },
    },
  };
}

/** 创建按固定块输出、但不会一次分配完整大文件的文件测试替身。 */
function module001CreateSyntheticFile(module001Size, module001ChunkSize) {
  return {
    size: module001Size,
    stream() {
      let module001Remaining = module001Size;
      const module001SharedChunk = new Uint8Array(module001ChunkSize);

      return new ReadableStream({
        pull(module001Controller) {
          if (module001Remaining === 0) {
            module001Controller.close();
            return;
          }

          const module001NextSize = Math.min(
            module001Remaining,
            module001ChunkSize,
          );
          module001Controller.enqueue(
            module001NextSize === module001ChunkSize
              ? module001SharedChunk
              : module001SharedChunk.subarray(0, module001NextSize),
          );
          module001Remaining -= module001NextSize;
        },
      });
    },
  };
}

describe("module001 大文件流式复制", () => {
  it("以 1 MB 分块走通 500 MB 目标路径且不组装完整副本", async () => {
    const module001Target = module001CreateCountingTarget();
    const module001Size = 500 * 1024 * 1024;
    let module001LastProgress = null;

    await module001CopyFileStream({
      module001SourceFile: module001CreateSyntheticFile(
        module001Size,
        1024 * 1024,
      ),
      module001TargetDirectory: module001Target.directory,
      module001TargetName: "model.glb",
      module001OnProgress: (module001Progress) => {
        module001LastProgress = module001Progress;
      },
    });

    expect(module001Target.state).toMatchObject({
      aborted: false,
      closed: true,
      writeCount: 500,
      writtenBytes: module001Size,
    });
    expect(module001LastProgress).toEqual({
      writtenBytes: module001Size,
      totalBytes: module001Size,
    });
  });
});
