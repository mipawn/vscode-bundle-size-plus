# Bundle Size Plus

A VSCode extension that displays the bundle size of imported packages directly in your editor, with support for JavaScript, TypeScript, Vue, and Svelte files.

> **Inspired by**: This project is inspired by and extends the ideas from [vscode-bundle-size](https://github.com/ambar/vscode-bundle-size), adding support for Vue and Svelte single-file components.

## Features

- **Local Bundle Analysis (esbuild)**: Bundles packages locally (using your workspace `esbuild`), measuring minified + gzipped output based on the versions you actually have installed
- **Inline Decorations + Hover**: Shows sizes right next to `import`/`export`/`require()` lines, with hover details (resolved path / version / sizes)
- **Import-Signature Aware**: Measures what you import (default/named/namespace/side-effect) so tree-shaking can reflect smaller imports
- **Vue & Svelte Support**: Parses `<script>` / `<script setup>` blocks (including `lang="ts"`, `lang="tsx"`, `lang="jsx"`)
- **Local/Workspace Imports**: For resolved workspace files, measures bundled size when possible and falls back to raw file size + gzipped size (supports common aliases and `tsconfig.json` paths)
- **Offline by Design**: No external API calls; results are cached and computed lazily for visible imports

## Supported File Types

- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- Vue (`.vue`) - Parses `<script>` sections
- Svelte (`.svelte`) - Parses `<script>` sections

## Supported Syntax

- `import ... from 'pkg'`, `import * as ns from 'pkg'`, `import { named } from 'pkg'`
- `import 'pkg'` (side-effect imports)
- `export * from 'pkg'`, `export { named } from 'pkg'`
- `const x = require('pkg')`, `const { named } = require('pkg')`

## Usage

Open any supported file with imports; sizes appear at the end of the line. Hover the size label for details.

```javascript
import React from 'react'; // 6.4KB (2.1KB zipped)
import lodash from 'lodash'; // 72.5KB (24.3KB zipped)
```

## How It Works

The extension:

1. Parses import statements from your code using Babel parser
2. Uses your workspace `esbuild` (if available) to bundle each imported package locally
3. Calculates minified and gzipped sizes
4. Displays the results as inline hints in your editor
5. Caches results to improve performance

### Why Local Bundling?

Unlike extensions that rely on external APIs (like Bundlephobia), this extension:

- **More Accurate**: Uses your actual installed package versions
- **Works Offline**: No internet connection required
- **Faster**: No network latency after initial bundling
- **Private**: Your package usage data stays local

## Configuration

You can customize the extension behavior through VSCode settings:

| Setting                                |    Default | Description                                  |
| -------------------------------------- | ---------: | -------------------------------------------- |
| `bundleSizePlus.enableInlayHints`      |     `true` | Enable/disable the inline size display       |
| `bundleSizePlus.showGzipSize`          |     `true` | Show gzipped size as primary size indicator  |
| `bundleSizePlus.cacheDuration`         | `86400000` | Cache duration in milliseconds (24 hours)    |
| `bundleSizePlus.sizeDisplayFormat`     |    `short` | Display format: `short` or `detailed`        |
| `bundleSizePlus.showOnlyLargePackages` |    `false` | Only show hints for packages above threshold |
| `bundleSizePlus.largePackageThreshold` |    `50000` | Threshold in bytes for large packages (50KB) |

## Commands

- `bundleSizePlus.clearCache`: Clear the in-memory bundle size cache
- `bundleSizePlus.toggleInlayHints`: Toggle the inline display on/off

## Theme / Color

Hints are color-coded by size (≥100KB warning, ≥500KB heavy). Customize via these theme tokens:
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

## Requirements

- VSCode version 1.80.0 or higher
- Project with `node_modules` directory (packages must be installed)
- For bundle-size results, `esbuild` must be resolvable:
  - First from your project dependencies (recommended; Vite projects are usually fine even if `esbuild` is transitive)
  - Then from a global install (`npm i -g esbuild`)
  - If not found, check **Output → Bundle Size Plus** for the warning log, and the extension will fall back to resolved file sizes when possible
  - If you use pnpm and `esbuild` isn't resolvable, add it explicitly: `pnpm add -D esbuild`

## Limitations

- Some packages may not be bundleable (e.g., packages with native dependencies)
- First-time bundling may take a moment for large packages
- Sizes are calculated with esbuild (browser/ESM, minified + tree-shaken) and may differ from your real build setup
- If `esbuild` is missing from the workspace, bundle sizes are unavailable and file-size fallbacks are used instead

## Installation

### From VSCode Marketplace

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Bundle Size Plus"
4. Click Install

### Manual Installation

1. Download the `.vsix` file from the releases page
2. Open VSCode
3. Go to Extensions
4. Click the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

---

**Enjoy coding with Bundle Size Plus!**
