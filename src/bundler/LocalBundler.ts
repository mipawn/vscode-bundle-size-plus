import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { createRequire } from 'module';
import { logWarnToOutput } from '../utils/logger';
type EsbuildModule = typeof import('esbuild');

const ASSET_LOADERS: Record<string, 'file'> = {
  // Styles (preprocessors): we can't compile these without plugins, so treat as assets.
  '.less': 'file',
  '.sass': 'file',
  '.scss': 'file',
  '.styl': 'file',
  '.stylus': 'file',
  // Images
  '.svg': 'file',
  '.png': 'file',
  '.jpg': 'file',
  '.jpeg': 'file',
  '.gif': 'file',
  '.webp': 'file',
  '.avif': 'file',
  '.ico': 'file',
  '.bmp': 'file',
  '.tiff': 'file',
  // Fonts
  '.woff': 'file',
  '.woff2': 'file',
  '.ttf': 'file',
  '.otf': 'file',
  '.eot': 'file',
  // Other common binaries
  '.wasm': 'file',
};

function findWorkspaceTsconfig(workspaceRoot: string): string | undefined {
  const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath) && fs.statSync(tsconfigPath).isFile()) {
    return tsconfigPath;
  }

  const jsconfigPath = path.join(workspaceRoot, 'jsconfig.json');
  if (fs.existsSync(jsconfigPath) && fs.statSync(jsconfigPath).isFile()) {
    return jsconfigPath;
  }

  return undefined;
}

function isInNodeModules(filePath: string): boolean {
  return filePath.includes(`${path.sep}node_modules${path.sep}`);
}

const workspaceEsbuildCache = new Map<string, EsbuildModule | null>();
let globalEsbuildModule: EsbuildModule | null = null;
let triedGlobalEsbuild = false;
const warnedMissingEsbuild = new Set<string>();

function warnMissingEsbuildOnce(scope: string, error?: unknown): void {
  if (warnedMissingEsbuild.has(scope)) {
    return;
  }
  warnedMissingEsbuild.add(scope);

  const message =
    `[Bundle Size Plus] Could not resolve \`esbuild\` (${scope}). Local bundling is disabled.\n` +
    `Tried: project dependencies (including Vite) -> global install.\n` +
    `Fix: install \`esbuild\` in your project (recommended): npm i -D esbuild (or pnpm/yarn),\n` +
    `or install globally: npm i -g esbuild.\n` +
    `After installing, run "Bundle Size Plus: Clear Cache" or reload VS Code.`;

  logWarnToOutput(message, error);
  console.warn(message, error);
}

function tryLoadEsbuildFromWorkspace(workspaceRoot: string): { module: EsbuildModule | null; error?: unknown } {
  let lastError: unknown;

  try {
    const requireFromWorkspace = createRequire(path.join(workspaceRoot, 'package.json'));

    try {
      return { module: requireFromWorkspace('esbuild') as EsbuildModule };
    } catch (error) {
      lastError = error;
    }

    // Vite projects often have esbuild as a transitive dependency (e.g. pnpm),
    // so try resolving esbuild from Vite's dependency tree.
    try {
      const viteEntry = requireFromWorkspace.resolve('vite');
      const requireFromVite = createRequire(viteEntry);
      return { module: requireFromVite('esbuild') as EsbuildModule };
    } catch (error) {
      lastError = lastError ?? error;
    }

    // If Vite is ESM-only in this environment, require.resolve('vite') may fail due to exports.
    // As a fallback, try the physical path from node_modules.
    try {
      const viteDir = path.join(workspaceRoot, 'node_modules', 'vite');
      if (fs.existsSync(viteDir)) {
        const realViteDir = fs.realpathSync(viteDir);
        const requireFromViteDir = createRequire(path.join(realViteDir, 'package.json'));
        return { module: requireFromViteDir('esbuild') as EsbuildModule };
      }
    } catch (error) {
      lastError = lastError ?? error;
    }
  } catch (error) {
    lastError = error;
  }

  return { module: null, error: lastError };
}

function tryLoadEsbuildFromGlobal(): { module: EsbuildModule | null; error?: unknown } {
  if (triedGlobalEsbuild) {
    return { module: globalEsbuildModule };
  }

  triedGlobalEsbuild = true;
  let lastError: unknown;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleBuiltin = require('module') as { globalPaths?: string[] };
    const globalPaths = Array.isArray(moduleBuiltin.globalPaths) ? moduleBuiltin.globalPaths : [];

    for (const globalPath of globalPaths) {
      try {
        const requireFromGlobal = createRequire(path.join(globalPath, 'package.json'));
        globalEsbuildModule = requireFromGlobal('esbuild') as EsbuildModule;
        return { module: globalEsbuildModule };
      } catch (error) {
        lastError = error;
      }
    }
  } catch (error) {
    lastError = error;
  }

  globalEsbuildModule = null;
  return { module: null, error: lastError };
}

function getEsbuild(workspaceRoot?: string): EsbuildModule | null {
  if (workspaceRoot) {
    const cachedWorkspace = workspaceEsbuildCache.get(workspaceRoot);
    if (cachedWorkspace) {
      return cachedWorkspace;
    }

    let workspaceError: unknown;
    if (cachedWorkspace === undefined) {
      const workspaceLoad = tryLoadEsbuildFromWorkspace(workspaceRoot);
      workspaceEsbuildCache.set(workspaceRoot, workspaceLoad.module);
      if (workspaceLoad.module) {
        return workspaceLoad.module;
      }
      workspaceError = workspaceLoad.error;
    }

    const globalLoad = tryLoadEsbuildFromGlobal();
    if (globalLoad.module) {
      return globalLoad.module;
    }

    warnMissingEsbuildOnce(workspaceRoot, workspaceError ?? globalLoad.error);
    return null;
  }

  const globalLoad = tryLoadEsbuildFromGlobal();
  if (globalLoad.module) {
    return globalLoad.module;
  }

  warnMissingEsbuildOnce('global', globalLoad.error);
  return null;
}

export interface BundleSizeResult {
  name: string;
  size: number;
  gzip: number;
  version: string;
}

export interface BundleRequest {
  /**
   * A stable identifier used for caching/deduping (per workspace).
   * Must include enough info to represent the import granularity.
   */
  id: string;

  /**
   * Human-friendly label for hover.
   */
  displayName: string;

  /**
   * ESM entry contents used for bundling/measurement.
   */
  entryContent: string;

  /**
   * Root package name for reading version from node_modules.
   * If not available, version will be reported as 'unknown'.
   */
  versionPackageName: string | null;
}

export type BundleCacheState = 'cached' | 'pending' | 'failed' | 'missing' | 'unavailable';

interface CacheEntry {
  data: BundleSizeResult;
  timestamp: number;
}

type PendingBuild = {
  generation: number;
  promise: Promise<BundleSizeResult | null>;
};

/**
 * LocalBundler uses esbuild to bundle packages locally and calculate their sizes.
 * This provides more accurate results than online APIs as it uses the actual
 * package versions installed in the project.
 */
export class LocalBundler {
  private cache = new Map<string, CacheEntry>();
  private pendingBuilds = new Map<string, PendingBuild>();
  private failedPackages = new Map<string, number>();
  private readonly failedCacheDuration = 5 * 60 * 1000; // 5 minutes
  private readonly cacheDuration = 60 * 60 * 1000; // 1 hour
  private cacheGeneration = 0;

  /**
   * Get the bundle size for an import signature using local esbuild bundling.
   */
  async getBundleSize(request: BundleRequest, workspaceRoot: string): Promise<BundleSizeResult | null> {
    const cacheKey = `${workspaceRoot}:${request.id}`;
    const generation = this.cacheGeneration;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    // Check if recently failed
    const failedTime = this.failedPackages.get(cacheKey);
    if (failedTime && Date.now() - failedTime < this.failedCacheDuration) {
      return null;
    }

    // Check for pending build
    const pending = this.pendingBuilds.get(cacheKey);
    if (pending && pending.generation === generation) {
      return pending.promise;
    }

    // Start new build
    const buildPromise = this.buildAndMeasure(request, workspaceRoot, cacheKey, generation);
    this.pendingBuilds.set(cacheKey, { generation, promise: buildPromise });

    try {
      return await buildPromise;
    } finally {
      const current = this.pendingBuilds.get(cacheKey);
      if (current?.promise === buildPromise) {
        this.pendingBuilds.delete(cacheKey);
      }
    }
  }

  /**
   * Back-compat: treat as "whole-package" measurement.
   */
  async getPackageSize(packageName: string, workspaceRoot: string): Promise<BundleSizeResult | null> {
    return this.getBundleSize(
      {
        id: `pkg:${packageName}`,
        displayName: packageName,
        entryContent: `export * from '${packageName}';`,
        versionPackageName: packageName,
      },
      workspaceRoot
    );
  }

  /**
   * Get cached size synchronously (returns null if not cached)
   */
  getCachedBundleSize(id: string, workspaceRoot: string): BundleSizeResult | null {
    const cacheKey = `${workspaceRoot}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    return null;
  }

  /**
   * Back-compat: cached "whole-package" measurement.
   */
  getCachedSize(packageName: string, workspaceRoot: string): BundleSizeResult | null {
    return this.getCachedBundleSize(`pkg:${packageName}`, workspaceRoot);
  }

  /**
   * Whether local bundling is available for the given workspace.
   */
  isBundlingAvailable(workspaceRoot: string): boolean {
    return getEsbuild(workspaceRoot) !== null;
  }

  /**
   * Introspection for UI layers to decide what to display without triggering extra work.
   */
  getBundleCacheState(id: string, workspaceRoot: string): BundleCacheState {
    const cacheKey = `${workspaceRoot}:${id}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return 'cached';
    }

    const generation = this.cacheGeneration;
    const pending = this.pendingBuilds.get(cacheKey);
    if (pending && pending.generation === generation) {
      return 'pending';
    }

    const failedTime = this.failedPackages.get(cacheKey);
    if (failedTime && Date.now() - failedTime < this.failedCacheDuration) {
      return 'failed';
    }

    if (!this.isBundlingAvailable(workspaceRoot)) {
      return 'unavailable';
    }

    return 'missing';
  }

  private async buildAndMeasure(
    request: BundleRequest,
    workspaceRoot: string,
    cacheKey: string,
    generation: number
  ): Promise<BundleSizeResult | null> {
    try {
      // Get package version from node_modules
      const version =
        request.versionPackageName ? this.getPackageVersion(request.versionPackageName, workspaceRoot) : null;
      const versionLabel = request.versionPackageName ? (version ?? 'unknown') : 'local';

      // Build the package with esbuild
      const result = await this.bundleEntry(request.entryContent, workspaceRoot);
      if (!result) {
        if (generation === this.cacheGeneration) {
          this.failedPackages.set(cacheKey, Date.now());
        }
        return null;
      }

      const sizeResult: BundleSizeResult = {
        name: request.displayName,
        size: result.minified,
        gzip: result.gzip,
        version: versionLabel,
      };

      // Cache the result
      if (generation === this.cacheGeneration) {
        this.cache.set(cacheKey, {
          data: sizeResult,
          timestamp: Date.now(),
        });
      }

      return sizeResult;
    } catch (error) {
      console.error(`Failed to bundle ${request.displayName}:`, error);
      if (generation === this.cacheGeneration) {
        this.failedPackages.set(cacheKey, Date.now());
      }
      return null;
    }
  }

  private getPackageVersion(packageName: string, workspaceRoot: string): string | null {
    try {
      // Handle scoped packages
      const packageJsonPath = path.join(
        workspaceRoot,
        'node_modules',
        packageName,
        'package.json'
      );

      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || null;
    } catch {
      return null;
    }
  }

  private async bundleEntry(entryContent: string, workspaceRoot: string): Promise<{ minified: number; gzip: number } | null> {
    try {
      const esbuild = getEsbuild(workspaceRoot);
      if (!esbuild) {
        return null;
      }

      const tsconfig = findWorkspaceTsconfig(workspaceRoot);

      const gracefulExternalizePlugin: import('esbuild').Plugin = {
        name: 'bundle-size-plus-graceful-externalize',
        setup(build) {
          const resolveCache = new Map<string, import('esbuild').OnResolveResult>();
          const skipResolveKey = '__bundleSizePlusSkipResolve';

          build.onResolve({ filter: /\.node$/ }, (args) => {
            return { path: args.path, external: true };
          });

          build.onResolve({ filter: /^[^./][^:]*$/ }, async (args) => {
            if ((args.pluginData as any)?.[skipResolveKey]) {
              return;
            }

            // Only treat unresolved imports from within node_modules as optional/missing.
            // Workspace code should still surface real resolution errors.
            if (!args.importer || !isInNodeModules(args.importer)) {
              return;
            }

            const cacheKey = `${args.importer}\0${args.path}`;
            const cached = resolveCache.get(cacheKey);
            if (cached) {
              return cached;
            }

            const resolved = await build.resolve(args.path, {
              importer: args.importer,
              resolveDir: args.resolveDir,
              kind: args.kind,
              pluginData: { [skipResolveKey]: true },
            });

            if (resolved.errors.length > 0) {
              const externalized: import('esbuild').OnResolveResult = { path: args.path, external: true };
              resolveCache.set(cacheKey, externalized);
              return externalized;
            }

            const result: import('esbuild').OnResolveResult = {
              path: resolved.path,
              namespace: resolved.namespace,
              external: resolved.external,
              sideEffects: resolved.sideEffects,
              pluginData: resolved.pluginData,
            };

            resolveCache.set(cacheKey, result);
            return result;
          });
        },
      };

      const result = await esbuild.build({
        stdin: {
          contents: entryContent,
          resolveDir: workspaceRoot,
          loader: 'js',
        },
        bundle: true,
        write: false,
        // Required when CSS (and other emitted assets) are part of the bundle graph.
        // We don't write to disk (`write:false`), but esbuild still needs a path
        // to derive output filenames.
        outfile: path.join(workspaceRoot, '__bundle_size_plus_entry__.js'),
        minify: true,
        treeShaking: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        tsconfig,
        loader: ASSET_LOADERS,
        plugins: [gracefulExternalizePlugin],
        // Externalize node built-ins
        external: [
          'node:*',
          'fs',
          'path',
          'os',
          'crypto',
          'stream',
          'util',
          'events',
          'buffer',
          'http',
          'https',
          'url',
          'querystring',
          'zlib',
          'net',
          'tls',
          'child_process',
          'cluster',
          'dgram',
          'dns',
          'readline',
          'repl',
          'tty',
          'vm',
          'assert',
          'constants',
          'domain',
          'punycode',
          'string_decoder',
          'timers',
          'console',
          'process',
          'worker_threads',
          'perf_hooks',
          'async_hooks',
          'inspector',
          'trace_events',
          'v8',
        ],
        logLevel: 'silent',
        metafile: true,
      });

      if (!result.outputFiles || result.outputFiles.length === 0) {
        return null;
      }

      const minifiedSize = result.outputFiles.reduce((sum, file) => sum + file.contents.length, 0);
      const gzippedSize = result.outputFiles.reduce(
        (sum, file) => sum + zlib.gzipSync(file.contents, { level: 3 }).length,
        0
      );

      return {
        minified: minifiedSize,
        gzip: gzippedSize,
      };
    } catch (error) {
      // Log but don't throw - some packages may not be bundleable
      console.debug('Could not bundle entry:', error);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cacheGeneration += 1;
    this.cache.clear();
    this.pendingBuilds.clear();
    this.failedPackages.clear();

    // Allow re-detecting workspace esbuild (e.g. after installing it).
    workspaceEsbuildCache.clear();
    globalEsbuildModule = null;
    triedGlobalEsbuild = false;
    warnedMissingEsbuild.clear();
  }

  /**
   * Format bytes to human readable string
   */
  formatSize(bytes: number): string {
    if (bytes === 0) {
      return '0B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

    const formattedValue = value % 1 === 0 ? value.toFixed(0) : value.toString();
    return `${formattedValue}${sizes[i]}`;
  }
}
