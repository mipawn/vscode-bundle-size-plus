# Quick Reference Guide

## Project: vscode-bundle-size-plus

### Quick Start

```bash
# Navigate to project
cd /Users/dongzhan/Desktop/mipawn/vscode-bundle-size-plus

# Run setup script
./setup.sh

# Or manually:
npm install
npm run build

# Open in VSCode
code .

# Press F5 to launch extension in debug mode
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build` | Build extension once |
| `npm run watch` | Build and watch for changes |
| `npm run compile` | TypeScript compilation only |
| `npm run package` | Create .vsix package |
| `npm run publish` | Publish to marketplace |

### File Organization

```
vscode-bundle-size-plus/
│
├── Configuration Files
│   ├── package.json          → Extension manifest & dependencies
│   ├── tsconfig.json         → TypeScript configuration
│   ├── build.js              → esbuild bundler setup
│   ├── .gitignore            → Git ignore rules
│   ├── .vscodeignore         → Package exclude rules
│   ├── .editorconfig         → Code style rules
│   └── .prettierrc           → Prettier formatting
│
├── Source Code (src/)
│   ├── extension.ts          → Main entry point
│   ├── parsers/
│   │   ├── ImportParser.ts   → Main parser (JS/TS)
│   │   ├── VueParser.ts      → Vue SFC parser
│   │   └── SvelteParser.ts   → Svelte parser
│   ├── providers/
│   │   ├── BundleSizeProvider.ts    → API & cache
│   │   └── InlayHintsProvider.ts    → VSCode hints
│   └── utils/
│       └── helpers.ts        → Utility functions
│
├── Testing (test/)
│   └── fixtures/
│       ├── sample.js         → JS test file
│       ├── sample.tsx        → TypeScript React
│       ├── sample.vue        → Vue 3 SFC
│       └── sample.svelte     → Svelte component
│
├── VSCode Config (.vscode/)
│   ├── launch.json           → Debug configuration
│   ├── tasks.json            → Build tasks
│   ├── settings.json         → Workspace settings
│   └── extensions.json       → Recommended extensions
│
└── Documentation
    ├── README.md             → User guide
    ├── DEVELOPMENT.md        → Developer guide
    ├── PROJECT_OVERVIEW.md   → Technical overview
    ├── CHANGELOG.md          → Version history
    ├── LICENSE               → MIT License
    └── setup.sh              → Quick setup script
```

### Key Dependencies

**Runtime:**
- `@vue/compiler-sfc@^3.4.0` - Parse Vue files
- `svelte@^4.0.0` - Parse Svelte files
- `@babel/parser@^7.23.0` - Parse JS/TS AST
- `axios@^1.6.0` - HTTP requests

**Development:**
- `typescript@^5.0.0` - Type safety
- `esbuild@^0.19.0` - Fast bundling
- `@types/vscode@^1.80.0` - VSCode API types
- `@vscode/vsce@^2.22.0` - Extension packaging

### Configuration Options

Settings can be changed in VSCode preferences:

```json
{
  // Enable/disable inline hints
  "bundleSizePlus.enableInlayHints": true,

  // Show gzipped or minified size
  "bundleSizePlus.showGzipSize": true,

  // Cache duration (milliseconds)
  "bundleSizePlus.cacheDuration": 86400000,

  // Show in status bar
  "bundleSizePlus.statusBarEnabled": true
}
```

### Commands

Access via Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`):

- **Bundle Size Plus: Clear Cache** - Clear all cached size data
- **Bundle Size Plus: Toggle Inlay Hints** - Enable/disable hints

### Supported File Types

| Language | Extensions | Features |
|----------|-----------|----------|
| JavaScript | .js, .jsx | Full support |
| TypeScript | .ts, .tsx | Full support |
| Vue | .vue | Parses `<script>` sections |
| Svelte | .svelte | Parses `<script>` sections |

### Import Patterns Supported

```javascript
// ES6 Imports
import React from 'react';
import { useState } from 'react';
import * as lodash from 'lodash';

// CommonJS
const axios = require('axios');
const { ref } = require('vue');

// Vue SFC <script> and <script setup>
// Svelte <script> and <script lang="ts">
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Build** with `npm run watch` (or `npm run build`)
3. **Debug** by pressing `F5` in VSCode
4. **Test** in the Extension Development Host window
5. **Check** Debug Console for errors

### Debugging Tips

- **View Logs**: Debug Console (bottom panel)
- **Set Breakpoints**: Directly in `.ts` files
- **Reload Extension**: `Ctrl+R` / `Cmd+R` in dev window
- **Check Output**: View → Output → "Bundle Size Plus"

### Common Issues

| Issue | Solution |
|-------|----------|
| Extension not loading | Check Debug Console, rebuild |
| No hints showing | Enable in settings, check file type |
| Sizes not fetching | Check internet, verify package exists |
| Build errors | Delete `dist/`, `node_modules/`, reinstall |

### API Information

**Endpoint:** `https://bundlephobia.com/api/size`

**Parameters:** `?package=<package-name>`

**Response:**
```json
{
  "name": "react",
  "size": 6540,      // minified bytes
  "gzip": 2610,      // gzipped bytes
  "version": "18.2.0"
}
```

### Publishing Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Test all features manually
- [ ] Run `npm run build` successfully
- [ ] Create package: `npm run package`
- [ ] Test .vsix installation
- [ ] Publish: `npm run publish`

### Useful Links

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Bundlephobia](https://bundlephobia.com/)
- [esbuild Documentation](https://esbuild.github.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Contact & Support

For issues or contributions, see the project repository.

---

**Quick Setup**: `./setup.sh`
**Start Coding**: Press `F5` in VSCode
**Documentation**: See `DEVELOPMENT.md` and `PROJECT_OVERVIEW.md`
