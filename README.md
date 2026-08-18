# 鲲的工具组

`kunstools.xin` 是一个使用 JavaScript、Next.js App Router 和 Tailwind CSS 构建的集成功能平台。当前包含：

- `001 可视化固定资产管理台账`
- `002 党建会议记录辅助生成工具`

## 本地运行

```bash
npm install
npm run dev
```

模块 002 请使用桌面版 Chrome 或 Edge，并在入口选择一个本地工作文件夹。只有使用 DeepSeek 生成功能时，才需要把 `.env.example` 复制为 `.env.local` 并填写服务端 `DEEPSEEK_API_KEY`；密钥不会写入浏览器或工作区文件。

## 检查

```bash
npm run lint
npm test
npm run build
npm run test:e2e -- --grep "^002"
```

当前按要求仅本地使用，尚未发布到 EdgeOne Makers。
