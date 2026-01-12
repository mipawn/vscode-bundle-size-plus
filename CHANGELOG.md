# Changelog

All notable changes to the "Bundle Size Plus" extension will be documented in this file.

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

## [Unreleased]

### Planned
- Support for more file types (Angular, etc.)
- Custom API endpoint configuration
- Offline mode with local package analysis
- Performance optimizations
- Unit tests and integration tests
