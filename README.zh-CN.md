# Bundle Size Plus

一个可以在编辑器中直接显示导入包体积大小的 VSCode 扩展，支持 JavaScript、TypeScript、Vue 和 Svelte 文件。

> **灵感来源**：本项目受 [vscode-bundle-size](https://github.com/ambar/vscode-bundle-size) 启发，并在其基础上扩展了对 Vue 和 Svelte 单文件组件的支持。

## 特性

- **本地打包分析 (esbuild)**：在本地打包依赖包（使用你工作区的 `esbuild`），基于实际安装的版本测量压缩和 gzip 后的体积
- **行内装饰 + 悬停提示**：在 `import`/`export`/`require()` 行旁边直接显示体积，悬停可查看详细信息（解析路径/版本/体积）
- **导入签名感知**：测量你实际导入的内容（默认导出/命名导出/命名空间导入/副作用导入），tree-shaking 可以反映更小的导入体积
- **Vue & Svelte 支持**：解析 `<script>` / `<script setup>` 代码块（包括 `lang="ts"`、`lang="tsx"`、`lang="jsx"`）
- **本地/工作区导入**：对于解析的本地文件，能打包时显示打包体积，无法打包/等待时回退显示原始文件大小和 gzip 后的大小（支持常见别名和 `tsconfig.json` 路径）
- **离线优先设计**：无需外部 API 调用；结果被缓存并按需计算可见的导入

## 支持的文件类型

- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- Vue (`.vue`) - 解析 `<script>` 部分
- Svelte (`.svelte`) - 解析 `<script>` 部分

## 支持的语法

- `import ... from 'pkg'`, `import * as ns from 'pkg'`, `import { named } from 'pkg'`
- `import 'pkg'` (副作用导入)
- `export * from 'pkg'`, `export { named } from 'pkg'`
- `const x = require('pkg')`, `const { named } = require('pkg')`

## 使用方法

打开任何包含导入语句的支持文件，体积信息会显示在行尾。将鼠标悬停在体积标签上可查看详细信息。

```javascript
import React from 'react'; // 6.4KB (2.1KB zipped)
import lodash from 'lodash'; // 72.5KB (24.3KB zipped)
```

## 工作原理

该扩展：

1. 使用 Babel 解析器解析代码中的导入语句
2. 使用你工作区的 `esbuild`（如果可用）在本地打包每个导入的包
3. 计算压缩和 gzip 后的体积
4. 在编辑器中以行内提示的形式显示结果
5. 缓存结果以提高性能

### 为什么使用本地打包？

与依赖外部 API（如 Bundlephobia）的扩展不同，本扩展：

- **更准确**：使用你实际安装的包版本
- **离线工作**：无需互联网连接
- **更快**：初次打包后无网络延迟
- **私密性**：你的包使用数据保留在本地

## 配置

你可以通过 VSCode 设置自定义扩展行为：

| 设置                                   |     默认值 | 描述                               |
| -------------------------------------- | ---------: | ---------------------------------- |
| `bundleSizePlus.enableInlayHints`      |     `true` | 启用/禁用行内体积显示              |
| `bundleSizePlus.showGzipSize`          |     `true` | 将 gzip 体积作为主要体积指标       |
| `bundleSizePlus.cacheDuration`         | `86400000` | 缓存持续时间（毫秒，默认 24 小时） |
| `bundleSizePlus.sizeDisplayFormat`     |    `short` | 显示格式：`short` 或 `detailed`    |
| `bundleSizePlus.showOnlyLargePackages` |    `false` | 仅显示超过阈值的包的提示           |
| `bundleSizePlus.largePackageThreshold` |    `50000` | 大包阈值（字节，默认 50KB）        |

## 命令

- `bundleSizePlus.clearCache`：清除内存中的打包体积缓存
- `bundleSizePlus.toggleInlayHints`：切换行内显示的开/关状态

## 主题/颜色

提示会按体积着色（≥100KB 黄色，≥500KB 红色）。可以通过主题标记自定义：
- `bundleSizePlus.inlayHint`
- `bundleSizePlus.inlayHintWarning`
- `bundleSizePlus.inlayHintHeavy`

```json
{
  "workbench.colorCustomizations": {
    "bundleSizePlus.inlayHint": "#00C853",
    "bundleSizePlus.inlayHintWarning": "#FFB300",
    "bundleSizePlus.inlayHintHeavy": "#FF5252"
  }
}
```

## 环境要求

- VSCode 版本 1.80.0 或更高
- 项目包含 `node_modules` 目录（包必须已安装）
- 要获得打包体积结果，`esbuild` 必须可被解析：
  - 首先从你的项目依赖中查找（推荐；Vite 项目通常没问题，即使 `esbuild` 是传递依赖）
  - 然后从全局安装中查找（`npm i -g esbuild`）
  - 如果未找到，请检查 **输出 → Bundle Size Plus** 查看警告日志，扩展将在可能的情况下回退到解析的文件大小
  - 如果你使用 pnpm 且 `esbuild` 无法解析，请显式添加：`pnpm add -D esbuild`

## 限制

- 某些包可能无法打包（例如，带有原生依赖的包）
- 首次打包大型包可能需要一些时间
- 体积是使用 esbuild（浏览器/ESM，压缩 + tree-shaking）计算的，可能与你的实际构建配置不同
- 如果工作区缺少 `esbuild`，打包体积将不可用，将使用文件大小作为后备方案

## 安装

### 从 VSCode 市场安装

1. 打开 VSCode
2. 进入扩展（Ctrl+Shift+X / Cmd+Shift+X）
3. 搜索 "Bundle Size Plus"
4. 点击安装

### 手动安装

1. 从发布页面下载 `.vsix` 文件
2. 打开 VSCode
3. 进入扩展
4. 点击 "..." 菜单并选择 "从 VSIX 安装..."
5. 选择下载的文件

## 开发

### 设置

```bash
npm install
```

### 构建

```bash
npm run build
```

### 监听模式

```bash
npm run watch
```

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

MIT

---

**使用 Bundle Size Plus 享受编码乐趣！**
