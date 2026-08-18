import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

// zip.js 依赖标准 Blob.stream；Node 实现补齐 jsdom 尚未提供的二进制接口。
Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile });
