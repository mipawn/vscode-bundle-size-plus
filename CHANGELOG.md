# Changelog

All notable changes to the "Bundle Size Plus" extension will be documented in this file.

## [0.5.0] - 2026-01-16

### Added

- Color-coded size hints (≥100KB warning, ≥500KB heavy)
- Theme tokens: `bundleSizePlus.inlayHintWarning` and `bundleSizePlus.inlayHintHeavy`
- Workspace imports now show bundled sizes instead of raw file sizes
- Auto-detect `tsconfig.json`/`jsconfig.json` for path resolution

### Fixed

- Gracefully handle missing/optional dependencies during bundling
- Externalize `.node` and `node:*` imports to prevent build failures
- Better loading states: `(bundling...)`, `(bundle failed)`, `(resolved)`

## [0.4.0] - 2026-01-14

### Added

- Command: `Bundle Size Plus: Show Output` to quickly open the extension output channel

### Fixed

- Monorepo/full-stack workspace support by resolving `esbuild` from the nearest `package.json` to the current file
- Local bundling now handles CSS and common asset imports more reliably (prevents misleading constant “resolved” sizes)
- Fallback hints are labeled as `(resolved)` to distinguish them from bundled sizes
- Warnings now auto-reveal the output channel for easier debugging

## [0.3.0] - 2026-01-14

### Changed

- Use esbuild to locally build and calculate size
- Switched release workflow to pnpm (added `pnpm-lock.yaml`)
- VSCE packaging/publishing now uses `--no-dependencies`

## [0.2.0] - 2026-01-12

### Added

- Support for local file imports with size calculation
- Configurable color themes for size hints
- Inline decorations for cleaner UI (no background)

### Changed

- Replaced inlay hints with inline decorations for better visual experience
- Improved Vue and Svelte parser support
- Optimized bundle size by externalizing optional dependencies
- Reduced VSIX package size from 417KB to 375KB (10% reduction)
- Updated extension icon with modern, professional design
- Replaced SVG icon with PNG format (128x128) for better VSCode marketplace compatibility

### Performance

- Removed sourcemap generation in production builds
- Enabled tree shaking for better code optimization
- Updated .vscodeignore to exclude documentation files from package

### Fixed

- Icon format now complies with VSCode marketplace requirements

## [0.1.0] - 2026-01-12

### Added

- Initial release of Bundle Size Plus
- Display bundle size inline for JavaScript, TypeScript, Vue, and Svelte files
- Support for import statements and require() calls
- Integration with bundlephobia API for accurate size data
- Configurable display options (minified vs gzipped)
- Smart caching system with configurable duration
- Vue SFC support with @vue/compiler-sfc
- Svelte component support
- Commands to clear cache and toggle inlay hints
- Status bar integration
- Multi-language support
- Inlay hints showing package sizes
- Hover tooltips with detailed size information
- Automatic cache management
- Relative import filtering
- Scoped package support
