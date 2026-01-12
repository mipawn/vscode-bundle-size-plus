# VSCode Bundle Size Plus - Quick Start Guide

## Installation & Setup

### Step 1: Install Dependencies

```bash
cd /Users/dongzhan/Desktop/mipawn/vscode-bundle-size-plus
npm install
```

### Step 2: Build the Extension

```bash
npm run build
```

### Step 3: Run in Development Mode

1. Open the project folder in VSCode
2. Press `F5` to launch Extension Development Host
3. Open test files in `test/fixtures/` to see bundle sizes appear

---

## Building & Packaging

### Create .vsix Package

```bash
# Install packaging tool (if not already installed)
npm install -g @vscode/vsce

# Package the extension
npm run package
```

This generates a `.vsix` file like `vscode-bundle-size-plus-0.1.0.vsix`

### Install .vsix Locally

```bash
# Option 1: Command line
code --install-extension vscode-bundle-size-plus-0.1.0.vsix

# Option 2: VSCode UI
# 1. Open VSCode Extensions panel (Ctrl+Shift+X)
# 2. Click "..." menu → "Install from VSIX..."
# 3. Select the .vsix file
```

---

## Publishing to VSCode Marketplace

### Prerequisites

1. **Create Azure DevOps Account**
   - Visit https://dev.azure.com
   - Create an organization

2. **Get Personal Access Token (PAT)**
   - Go to User Settings → Personal Access Tokens
   - Create new token with **Marketplace (Manage)** scope
   - Copy the token (shown only once)

3. **Create Publisher**
   ```bash
   vsce create-publisher <your-publisher-name>
   ```

### Publish Steps

```bash
# 1. Login with your PAT
vsce login <your-publisher-name>

# 2. Update package.json
# Add: "publisher": "your-publisher-name"

# 3. Publish
npm run publish
# or
vsce publish
```

### Version Bumping

```bash
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0
vsce publish 1.0.0   # Specific version
```

---

## Configuration

Available settings in VSCode (`bundleSizePlus.*`):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableInlayHints` | boolean | `true` | Enable inline hints |
| `showGzipSize` | boolean | `false` | Show gzip size (false = minified) |
| `cacheDuration` | number | `86400000` | Cache duration in ms (24 hours) |
| `statusBarEnabled` | boolean | `true` | Show status bar stats |

---

## Testing

### Test Files Included

Located in `test/fixtures/`:
- `sample.js` - JavaScript with ES6 imports
- `sample.tsx` - TypeScript React component
- `sample.vue` - Vue 3 SFC with `<script setup>`
- `sample.svelte` - Svelte component

### Manual Testing

1. Press `F5` to launch Extension Development Host
2. Open any test file
3. Verify bundle sizes appear after import statements
4. Hover over imports to see detailed info

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Build extension once |
| `npm run watch` | Build and watch for changes |
| `npm run compile` | TypeScript compilation only |
| `npm run package` | Create .vsix package |
| `npm run publish` | Publish to marketplace |

---

## Architecture Overview

### Parsers
- **ImportParser.ts** - JavaScript/TypeScript (uses `@babel/parser`)
- **VueParser.ts** - Vue SFC (uses `@vue/compiler-sfc`)
- **SvelteParser.ts** - Svelte components (custom parsing)

### Providers
- **BundleSizeProvider.ts** - Fetches sizes from Bundlephobia API with caching
- **InlayHintsProvider.ts** - VSCode InlayHintsProvider implementation

### Entry Point
- **extension.ts** - Activation, registration, and coordination

---

## Troubleshooting

### Issue: Extension doesn't activate
- Run `npm install` and `npm run build`
- Check VSCode Output panel for errors

### Issue: Bundle sizes don't show
- Check network connection (API access)
- Verify package names are correct
- Clear cache and retry

### Issue: Vue/Svelte not working
- Ensure `@vue/compiler-sfc` and `svelte` are installed
- Check file syntax is valid
- View Console in Developer Tools for errors

---

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Bundlephobia API](https://bundlephobia.com/api)

---

## License

MIT - See [LICENSE](./LICENSE) file
