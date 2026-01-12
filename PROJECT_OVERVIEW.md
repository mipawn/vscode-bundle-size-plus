# Bundle Size Plus - Project Overview

## 🎯 Project Summary

**vscode-bundle-size-plus** is a VSCode extension that displays the bundle size of imported npm packages directly in your editor, with special support for modern frameworks like Vue and Svelte.

## ✨ Key Features

1. **Multi-Language Support**
   - JavaScript (.js, .jsx)
   - TypeScript (.ts, .tsx)
   - Vue (.vue) - with SFC parsing
   - Svelte (.svelte) - with component parsing

2. **Inline Size Display**
   - Shows package sizes as inlay hints
   - Customizable display (minified/gzipped)
   - Hover tooltips with detailed information

3. **Smart Caching**
   - Configurable cache duration
   - Persistent cache across sessions
   - Manual cache clearing

4. **Framework Integration**
   - Uses @vue/compiler-sfc for Vue parsing
   - Native Svelte script extraction
   - Babel parser for accurate JS/TS parsing

## 📁 Project Structure

```
vscode-bundle-size-plus/
├── src/
│   ├── extension.ts                 # Main entry point
│   ├── parsers/
│   │   ├── ImportParser.ts          # Central import parsing logic
│   │   ├── VueParser.ts             # Vue SFC parser
│   │   └── SvelteParser.ts          # Svelte component parser
│   ├── providers/
│   │   ├── BundleSizeProvider.ts    # Fetches size from bundlephobia
│   │   └── InlayHintsProvider.ts    # VSCode inlay hints provider
│   └── utils/
│       └── helpers.ts               # Utility functions
├── test/fixtures/                   # Sample files for testing
├── .vscode/                         # VSCode configuration
├── package.json                     # Extension manifest
├── tsconfig.json                    # TypeScript config
└── build.js                         # esbuild bundler config
```

## 🔧 Technical Stack

### Core Dependencies
- **@vue/compiler-sfc** (^3.4.0): Parses Vue Single File Components
- **svelte** (^4.0.0): Parses Svelte components
- **@babel/parser** (^7.23.0): Parses JavaScript/TypeScript AST
- **axios** (^1.6.0): Makes API calls to bundlephobia

### Development Dependencies
- **TypeScript** (^5.0.0): Type-safe development
- **esbuild** (^0.19.0): Fast bundling
- **@vscode/vsce** (^2.22.0): Extension packaging

## 🚀 How It Works

### 1. Import Detection
```typescript
// The extension detects various import patterns:
import React from 'react';              // ES6 imports
const lodash = require('lodash');       // CommonJS requires
import { ref } from 'vue';              // Named imports
import * as moment from 'moment';       // Namespace imports
```

### 2. File Parsing

#### JavaScript/TypeScript
- Uses Babel parser to build AST
- Extracts ImportDeclaration nodes
- Fallback to regex if parsing fails

#### Vue Files
- Uses @vue/compiler-sfc to parse SFC
- Extracts <script> and <script setup> sections
- Parses script content with Babel

#### Svelte Files
- Extracts <script> tags with regex
- Detects TypeScript via lang attribute
- Parses script content with Babel

### 3. Size Fetching
```typescript
// API call to bundlephobia
GET https://bundlephobia.com/api/size?package=<package-name>

// Response includes:
{
  name: "package-name",
  size: 12345,        // minified size in bytes
  gzip: 4567,         // gzipped size in bytes
  version: "1.2.3"
}
```

### 4. Cache Management
- Stores results in VSCode global state
- Default cache: 24 hours
- Prevents duplicate API calls
- Survives VSCode restarts

### 5. Display
- Uses VSCode Inlay Hints API
- Shows size at end of import line
- Provides hover tooltips with details
- Updates automatically on file changes

## 📋 Configuration Options

```json
{
  "bundleSizePlus.enableInlayHints": true,
  "bundleSizePlus.showGzipSize": true,
  "bundleSizePlus.cacheDuration": 86400000,
  "bundleSizePlus.statusBarEnabled": true
}
```

## 🎨 User Experience

### Visual Example
```javascript
import React from 'react';        📦 6.4 kB (gzipped)
import lodash from 'lodash';      📦 24.3 kB (gzipped)
import axios from 'axios';        📦 13.2 kB (gzipped)
```

### Hover Information
```
lodash v4.17.21

- Minified: 69.9 kB
- Gzipped: 24.3 kB
```

## 🔍 Implementation Details

### Parser Strategy
1. **Primary**: Use framework-specific parsers
   - Vue: @vue/compiler-sfc
   - Svelte: Manual script extraction
   - JS/TS: Babel parser

2. **Fallback**: Regex-based parsing
   - Used when AST parsing fails
   - Less accurate but more forgiving

### Package Name Cleaning
```typescript
// Handles various patterns:
'react'                    → 'react'
'@vue/reactivity'          → '@vue/reactivity'
'./local-file'             → (skipped)
'lodash/debounce'          → 'lodash'
```

### Performance Optimizations
- Debounced parsing on file changes
- Parallel API requests with deduplication
- Efficient caching strategy
- Only parses visible ranges

## 🧪 Testing

### Manual Testing
1. Use provided test fixtures in `test/fixtures/`
2. Each fixture demonstrates different import patterns
3. Test all supported file types

### Test Files Included
- **sample.js**: JavaScript with various imports
- **sample.tsx**: TypeScript React component
- **sample.vue**: Vue 3 SFC with Composition API
- **sample.svelte**: Svelte component with stores

## 📦 Building & Publishing

### Development Build
```bash
npm run build        # One-time build
npm run watch        # Watch mode
```

### Production Package
```bash
npm run package      # Creates .vsix file
```

### Publishing to Marketplace
```bash
npm run publish      # Requires vsce login
```

## 🔮 Future Enhancements

### Planned Features
1. **Angular Support**: Parse Angular modules
2. **Custom API**: Support self-hosted bundlephobia
3. **Offline Mode**: Analyze without API
4. **Tree Shaking**: Show actual usage impact
5. **Comparison**: Compare package alternatives
6. **Alerts**: Warn on large packages
7. **Historical**: Track size changes over time

### Performance Improvements
1. **Worker Threads**: Offload parsing
2. **WebAssembly**: Faster parsing
3. **Incremental**: Parse only changes
4. **Compression**: Smaller cache storage

## 🐛 Known Limitations

1. **Network Dependency**: Requires internet for size data
2. **API Rate Limits**: Bundlephobia may throttle requests
3. **Accuracy**: Sizes are estimates, not exact
4. **Monorepos**: May not handle all workspace setups
5. **Dynamic Imports**: Limited support for computed imports

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! See DEVELOPMENT.md for setup instructions.

---

**Version**: 0.1.0
**Last Updated**: 2026-01-12
**Minimum VSCode**: 1.80.0
**Author**: Bundle Size Plus Contributors
