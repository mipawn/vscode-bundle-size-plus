# Bundle Size Plus

A VSCode extension that displays the bundle size of imported packages directly in your editor, with support for JavaScript, TypeScript, Vue, and Svelte files.

> **Inspired by**: This project is inspired by and extends the ideas from [vscode-bundle-size](https://github.com/ambar/vscode-bundle-size), adding support for Vue and Svelte single-file components.

## Features

- **Inline Size Display**: Shows package sizes directly next to import statements using inline decorations (no background)
- **Multi-Framework Support**: Works with JavaScript, TypeScript, Vue, and Svelte files
- **Real-time Information**: Fetches accurate bundle size data from bundlephobia API
- **Smart Caching**: Caches results to minimize API calls and improve performance
- **Customizable Display**: Choose between minified or gzipped sizes

## Supported File Types

- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- Vue (`.vue`) - Parses `<script>` sections
- Svelte (`.svelte`) - Parses `<script>` sections

## Usage

Simply open any supported file with import statements. The extension will automatically display the package size next to each import:

```javascript
import React from 'react'; // 📦 6.4 kB (gzipped)
import lodash from 'lodash'; // 📦 24.3 kB (gzipped)
```

## Configuration

You can customize the extension behavior through VSCode settings:

- `bundleSizePlus.enableInlayHints`: Enable/disable inline hints (default: `true`)
- `bundleSizePlus.showGzipSize`: Show gzipped size instead of minified size (default: `true`)
- `bundleSizePlus.cacheDuration`: Cache duration in milliseconds (default: `86400000` - 24 hours)
- `bundleSizePlus.statusBarEnabled`: Show package size in status bar (default: `true`)

## Requirements

- VSCode version 1.80.0 or higher
- Internet connection for fetching package size data

## How It Works

The extension:

1. Parses import statements from your code using Babel parser
2. Extracts package names from different file types (including Vue and Svelte)
3. Queries the bundlephobia API for accurate bundle size information
4. Displays the results as inline hints in your editor
5. Caches results to improve performance

## Installation

### From VSCode Marketplace (Coming Soon)

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

## Known Limitations

- Requires internet connection for initial package lookups
- Bundle sizes are fetched from bundlephobia, which may not reflect your exact bundle configuration
- Only works with npm packages published on the registry

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

Bundle size data provided by [Bundlephobia](https://bundlephobia.com/)

---

**Enjoy coding with Bundle Size Plus!**
