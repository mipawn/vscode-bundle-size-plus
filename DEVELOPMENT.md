# Development Setup Guide

This guide will help you set up the development environment for Bundle Size Plus.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Visual Studio Code (v1.80.0 or higher)

## Installation Steps

### 1. Install Dependencies

```bash
cd vscode-bundle-size-plus
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This will compile the TypeScript code and bundle it using esbuild.

### 3. Run in Development Mode

#### Option A: Using VSCode Debug

1. Open the project in VSCode
2. Press `F5` or go to Run → Start Debugging
3. This will open a new VSCode window with the extension loaded
4. Open any JavaScript, TypeScript, Vue, or Svelte file with imports

#### Option B: Using Watch Mode

```bash
npm run watch
```

Then press `F5` to launch the extension host.

## Project Structure

```
vscode-bundle-size-plus/
├── .vscode/                 # VSCode configuration
│   ├── extensions.json      # Recommended extensions
│   ├── launch.json          # Debug configurations
│   ├── settings.json        # Workspace settings
│   └── tasks.json           # Build tasks
├── src/                     # Source code
│   ├── parsers/             # File parsers
│   │   ├── ImportParser.ts  # Main import parser
│   │   ├── VueParser.ts     # Vue SFC parser
│   │   └── SvelteParser.ts  # Svelte component parser
│   ├── providers/           # VSCode providers
│   │   ├── BundleSizeProvider.ts    # Bundle size fetcher
│   │   └── InlayHintsProvider.ts    # Inlay hints provider
│   ├── utils/               # Utility functions
│   │   └── helpers.ts       # Helper functions
│   └── extension.ts         # Extension entry point
├── test/                    # Test files
│   └── fixtures/            # Test fixtures
│       ├── sample.js
│       ├── sample.tsx
│       ├── sample.vue
│       └── sample.svelte
├── dist/                    # Compiled output (generated)
├── package.json             # Project metadata
├── tsconfig.json            # TypeScript configuration
├── build.js                 # esbuild configuration
├── .gitignore              # Git ignore rules
├── .vscodeignore           # VSCode package ignore rules
├── .editorconfig           # Editor configuration
├── .prettierrc             # Prettier configuration
├── README.md               # User documentation
├── CHANGELOG.md            # Version history
└── LICENSE                 # MIT License
```

## Testing the Extension

### Manual Testing

1. Launch the extension in debug mode (`F5`)
2. In the new VSCode window, open the test fixtures:
   - `/test/fixtures/sample.js`
   - `/test/fixtures/sample.tsx`
   - `/test/fixtures/sample.vue`
   - `/test/fixtures/sample.svelte`
3. You should see bundle size hints appear next to import statements
4. Hover over the hints to see detailed information

### Testing Configuration

Test the configuration options:

1. Open VSCode Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Bundle Size Plus"
3. Try toggling:
   - `bundleSizePlus.enableInlayHints`
   - `bundleSizePlus.showGzipSize`
   - `bundleSizePlus.statusBarEnabled`

### Testing Commands

Open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and try:

- `Bundle Size Plus: Clear Cache`
- `Bundle Size Plus: Toggle Inlay Hints`

## Building for Production

### Package the Extension

```bash
npm run package
```

This creates a `.vsix` file that can be installed in VSCode.

### Install the Packaged Extension

```bash
code --install-extension vscode-bundle-size-plus-0.1.0.vsix
```

Or in VSCode:
1. Go to Extensions
2. Click the `...` menu
3. Select "Install from VSIX..."
4. Choose the `.vsix` file

## Publishing

### Prerequisites

1. Create a publisher account at https://marketplace.visualstudio.com/
2. Get a Personal Access Token (PAT) from Azure DevOps
3. Login with vsce:

```bash
npx vsce login <your-publisher-name>
```

### Publish to Marketplace

```bash
npm run publish
```

Or manually:

```bash
npx vsce publish
```

## Troubleshooting

### Extension Not Loading

1. Check the Debug Console for errors
2. Ensure all dependencies are installed: `npm install`
3. Rebuild the extension: `npm run build`
4. Restart the Extension Host: `Ctrl+R` or `Cmd+R` in the extension development window

### Inlay Hints Not Showing

1. Check that `bundleSizePlus.enableInlayHints` is enabled
2. Ensure you're viewing a supported file type (JS/TS/Vue/Svelte)
3. Check the network connection (required for bundlephobia API)
4. Look for errors in the Output panel (View → Output, select "Bundle Size Plus")

### Package Sizes Not Loading

1. Check internet connection
2. Verify the package exists on npm
3. Clear cache: Run "Bundle Size Plus: Clear Cache" command
4. Check the Debug Console for API errors

### Build Errors

If you encounter TypeScript errors:

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Development Tips

1. **Hot Reload**: Use watch mode (`npm run watch`) for automatic rebuilding
2. **Debugging**: Use VSCode's built-in debugger (set breakpoints in `.ts` files)
3. **Logging**: Check the Debug Console and Output panel for logs
4. **API Rate Limits**: The bundlephobia API has rate limits; use cache wisely

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Bundlephobia API](https://bundlephobia.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
