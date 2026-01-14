import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { createRequire } from 'module';

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Resolve a relative import path to an absolute file path
 */
export function resolveImportPath(
  importPath: string,
  currentFilePath: string,
  workspaceRoot?: string
): string | null {
  try {
    const normalizedImportPath = stripImportQuery(importPath);
    const currentDir = path.dirname(currentFilePath);

    // Relative imports: ./, ../
    if (normalizedImportPath.startsWith('./') || normalizedImportPath.startsWith('../')) {
      const resolvedPath = path.resolve(currentDir, normalizedImportPath);
      return resolveFilePath(resolvedPath);
    }

    // Workspace-root style imports: /foo/bar -> <workspaceRoot>/foo/bar
    if (workspaceRoot && normalizedImportPath.startsWith('/')) {
      const resolvedPath = path.resolve(workspaceRoot, normalizedImportPath.slice(1));
      return resolveFilePath(resolvedPath);
    }

    // Common aliases: @/, ~/, #/
    if (workspaceRoot) {
      // In monorepos, the VS Code workspace root may not be the package root.
      // Prefer resolving aliases relative to the nearest package.json when available.
      const packageRoot = findNearestPackageRoot(currentDir, workspaceRoot) ?? workspaceRoot;

      const aliasResolved = resolveWithCommonAliases(normalizedImportPath, packageRoot);
      if (aliasResolved) {
        return aliasResolved;
      }

      const tsconfigResolved = resolveWithTsconfigPaths(
        normalizedImportPath,
        currentDir,
        workspaceRoot
      );
      if (tsconfigResolved) {
        return tsconfigResolved;
      }
    }

    // Fall back to Node module resolution (node_modules, package exports, etc.)
    const nodeResolved = resolveWithNode(normalizedImportPath, currentFilePath);
    if (nodeResolved) {
      return nodeResolved;
    }

    return null;
  } catch (error) {
    console.error('Error resolving import path:', error);
    return null;
  }
}

function stripImportQuery(importPath: string): string {
  // Support Vite/Webpack style queries/fragments: foo?raw / foo#hash
  const queryIndex = importPath.indexOf('?');
  const hashIndex = importPath.indexOf('#');

  let end = importPath.length;
  if (queryIndex !== -1) {
    end = Math.min(end, queryIndex);
  }
  if (hashIndex !== -1) {
    end = Math.min(end, hashIndex);
  }

  return importPath.slice(0, end);
}

function resolveFilePath(resolvedPath: string): string | null {
  try {
    // Try direct file match
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      return resolvedPath;
    }

    // Try different extensions if the file doesn't exist
    const extensions = [
      '',
      '.js',
      '.mjs',
      '.cjs',
      '.ts',
      '.jsx',
      '.tsx',
      '.vue',
      '.svelte',
      '.json',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.styl',
    ];

    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        return testPath;
      }
    }

    // Try index files
    const indexExtensions = [
      '/index.js',
      '/index.mjs',
      '/index.cjs',
      '/index.ts',
      '/index.jsx',
      '/index.tsx',
      '/index.vue',
      '/index.svelte',
      '/index.json',
      '/index.css',
    ];

    for (const indexExt of indexExtensions) {
      const testPath = resolvedPath + indexExt;
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        return testPath;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function resolveWithCommonAliases(importPath: string, workspaceRoot: string): string | null {
  const candidates: string[] = [];

  if (importPath.startsWith('@/')) {
    const rest = importPath.slice(2);
    candidates.push(path.join(workspaceRoot, 'src', rest));
    candidates.push(path.join(workspaceRoot, rest));
  }

  if (importPath.startsWith('~/')) {
    const rest = importPath.slice(2);
    candidates.push(path.join(workspaceRoot, rest));
    candidates.push(path.join(workspaceRoot, 'src', rest));
  }

  if (importPath.startsWith('#/')) {
    const rest = importPath.slice(2);
    candidates.push(path.join(workspaceRoot, rest));
    candidates.push(path.join(workspaceRoot, 'src', rest));
  }

  for (const candidate of candidates) {
    const resolved = resolveFilePath(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

type TsconfigPathMatcher = {
  baseUrlDir: string;
  rules: Array<{ pattern: string; regex: RegExp; starCount: number; targets: string[] }>;
  mtimeMs: number;
};

const tsconfigMatcherCache = new Map<string, TsconfigPathMatcher | null>();
const nearestTsconfigCache = new Map<string, string | null>();
const nearestPackageRootCache = new Map<string, string | null>();

function findNearestPackageRoot(currentDir: string, workspaceRoot: string): string | null {
  const cacheKey = currentDir;
  const cached = nearestPackageRootCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let dir = currentDir;
  while (dir && dir.startsWith(workspaceRoot)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath) && fs.statSync(pkgPath).isFile()) {
      nearestPackageRootCache.set(cacheKey, dir);
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  nearestPackageRootCache.set(cacheKey, null);
  return null;
}

function resolveWithTsconfigPaths(
  importPath: string,
  currentDir: string,
  workspaceRoot: string
): string | null {
  const tsconfigPath = findNearestTsconfig(currentDir, workspaceRoot);
  if (!tsconfigPath) {
    return null;
  }

  const matcher = getTsconfigMatcher(tsconfigPath);
  if (!matcher) {
    return null;
  }

  for (const rule of matcher.rules) {
    const match = importPath.match(rule.regex);
    if (!match) {
      continue;
    }

    const stars = match.slice(1);
    for (const target of rule.targets) {
      const mapped = replaceStars(target, stars);
      const candidate = path.resolve(matcher.baseUrlDir, mapped);
      const resolved = resolveFilePath(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function findNearestTsconfig(currentDir: string, workspaceRoot: string): string | null {
  const cacheKey = currentDir;
  const cached = nearestTsconfigCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let dir = currentDir;
  while (dir && dir.startsWith(workspaceRoot)) {
    const tsconfigPath = path.join(dir, 'tsconfig.json');
    const jsconfigPath = path.join(dir, 'jsconfig.json');

    if (fs.existsSync(tsconfigPath) && fs.statSync(tsconfigPath).isFile()) {
      nearestTsconfigCache.set(cacheKey, tsconfigPath);
      return tsconfigPath;
    }

    if (fs.existsSync(jsconfigPath) && fs.statSync(jsconfigPath).isFile()) {
      nearestTsconfigCache.set(cacheKey, jsconfigPath);
      return jsconfigPath;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  nearestTsconfigCache.set(cacheKey, null);
  return null;
}

function getTsconfigMatcher(tsconfigPath: string): TsconfigPathMatcher | null {
  const stats = safeStat(tsconfigPath);
  const mtimeMs = stats?.mtimeMs ?? 0;

  const cached = tsconfigMatcherCache.get(tsconfigPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached;
  }

  if (!stats) {
    tsconfigMatcherCache.set(tsconfigPath, null);
    return null;
  }

  const raw = safeReadFile(tsconfigPath);
  if (!raw) {
    tsconfigMatcherCache.set(tsconfigPath, null);
    return null;
  }

  const json = parseJsonc(raw);
  const compilerOptions =
    (json && typeof json === 'object' ? (json as any).compilerOptions : undefined) ?? {};

  const baseUrl = typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.';
  const paths =
    compilerOptions.paths && typeof compilerOptions.paths === 'object' ? compilerOptions.paths : {};

  const tsconfigDir = path.dirname(tsconfigPath);
  const baseUrlDir = path.resolve(tsconfigDir, baseUrl);

  const rules: TsconfigPathMatcher['rules'] = [];
  for (const [pattern, targetsRaw] of Object.entries(paths as Record<string, unknown>)) {
    const targets = Array.isArray(targetsRaw)
      ? targetsRaw.filter((t): t is string => typeof t === 'string')
      : [];
    if (targets.length === 0) {
      continue;
    }

    const { regex, starCount } = patternToRegex(pattern);
    rules.push({ pattern, regex, starCount, targets });
  }

  const matcher: TsconfigPathMatcher = { baseUrlDir, rules, mtimeMs };
  tsconfigMatcherCache.set(tsconfigPath, matcher);
  return matcher;
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseJsonc(text: string): unknown {
  let jsonText = text.replace(/^\uFEFF/, '');
  jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '');
  jsonText = jsonText.replace(/\/\/.*$/gm, '');
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(jsonText);
  } catch {
    return {};
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern: string): { regex: RegExp; starCount: number } {
  const starCount = (pattern.match(/\*/g) || []).length;
  const escaped = escapeRegex(pattern).replace(/\\\*/g, '(.+?)');
  return { regex: new RegExp(`^${escaped}$`), starCount };
}

function replaceStars(target: string, stars: string[]): string {
  if (!target.includes('*')) {
    return target;
  }

  let starIndex = 0;
  return target.replace(/\*/g, () => {
    const value = stars[starIndex] ?? '';
    starIndex += 1;
    return value;
  });
}

function resolveWithNode(importPath: string, currentFilePath: string): string | null {
  // Skip node: protocol and built-ins
  if (importPath.startsWith('node:')) {
    return null;
  }

  try {
    const req = createRequire(currentFilePath);
    const resolved = req.resolve(importPath);
    return resolveFilePath(resolved) ?? resolved;
  } catch {
    return null;
  }
}

/**
 * Calculate the size of a local file in bytes
 */
export function getLocalFileSize(filePath: string): number | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    const cached = fileSizeCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.size;
    }

    fileSizeCache.set(filePath, { size: stats.size, mtime });
    return stats.size;
  } catch (error) {
    console.error('Error getting file size:', error);
    return null;
  }
}

/**
 * Check if an import path is a relative/local import
 */
export function isRelativeImport(packageName: string): boolean {
  return (
    packageName.startsWith('./') ||
    packageName.startsWith('../') ||
    packageName.startsWith('/') ||
    packageName.startsWith('~/')
  );
}

/**
 * Cache for gzip sizes to avoid recalculating
 * Key: filePath:mtime, Value: gzipSize
 */
const gzipCache = new Map<string, { size: number; mtime: number }>();
const fileSizeCache = new Map<string, { size: number; mtime: number }>();

/**
 * Calculate the gzipped size of a file in bytes with caching
 */
export function getGzipSize(filePath: string): number | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    // Check cache
    const cached = gzipCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.size;
    }

    // Calculate gzip size
    const content = fs.readFileSync(filePath);
    const gzipped = zlib.gzipSync(content, { level: 3 }); // Lower level for faster compression
    const gzipSize = gzipped.length;

    // Update cache
    gzipCache.set(filePath, { size: gzipSize, mtime });

    // Clean cache if it gets too large (keep only last 1000 entries)
    if (gzipCache.size > 1000) {
      const firstKey = gzipCache.keys().next().value;
      if (firstKey) {
        gzipCache.delete(firstKey);
      }
    }

    return gzipSize;
  } catch (error) {
    console.error('Error calculating gzip size:', error);
    return null;
  }
}
