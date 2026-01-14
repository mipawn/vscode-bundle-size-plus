import { LocalBundler, BundleCacheState, BundleRequest } from '../bundler/LocalBundler';
import type { ImportInfo, ImportKind } from '../parsers/ImportParser';

export interface PackageSizeInfo {
  name: string;
  size: number;
  gzip: number;
  version: string;
}

export class BundleSizeProvider {
  private readonly localBundler: LocalBundler;

  constructor() {
    this.localBundler = new LocalBundler();
  }

  getCachedPackageSize(packageName: string, workspaceRoot?: string): PackageSizeInfo | null {
    if (!workspaceRoot) {
      return null;
    }

    const request = this.createBundleRequest({
      packageName,
      kind: 'export',
      isExportAll: true,
    });
    if (!request) {
      return null;
    }

    return this.localBundler.getCachedBundleSize(request.id, workspaceRoot);
  }

  async getPackageSize(packageName: string, workspaceRoot?: string): Promise<PackageSizeInfo | null> {
    if (!workspaceRoot) {
      return null;
    }

    const request = this.createBundleRequest({
      packageName,
      kind: 'export',
      isExportAll: true,
    });
    if (!request) {
      return null;
    }

    return this.localBundler.getBundleSize(request, workspaceRoot);
  }

  getCachedImportSize(importInfo: ImportInfo, workspaceRoot?: string): PackageSizeInfo | null {
    if (!workspaceRoot) {
      return null;
    }

    const request = this.createBundleRequest(importInfo);
    if (!request) {
      return null;
    }

    return this.localBundler.getCachedBundleSize(request.id, workspaceRoot);
  }

  isBundlingAvailable(workspaceRoot?: string): boolean {
    if (!workspaceRoot) {
      return false;
    }
    return this.localBundler.isBundlingAvailable(workspaceRoot);
  }

  getImportCacheState(importInfo: ImportInfo, workspaceRoot?: string): BundleCacheState | 'unavailable' {
    if (!workspaceRoot) {
      return 'unavailable';
    }

    const request = this.createBundleRequest(importInfo);
    if (!request) {
      return 'unavailable';
    }

    return this.localBundler.getBundleCacheState(request.id, workspaceRoot);
  }

  async getImportSize(importInfo: ImportInfo, workspaceRoot?: string): Promise<PackageSizeInfo | null> {
    if (!workspaceRoot) {
      return null;
    }

    const request = this.createBundleRequest(importInfo);
    if (!request) {
      return null;
    }

    return this.localBundler.getBundleSize(request, workspaceRoot);
  }

  /**
   * Expose a stable cache id so callers can de-dupe work.
   */
  getImportCacheId(importInfo: ImportInfo): string | null {
    const request = this.createBundleRequest(importInfo);
    return request?.id ?? null;
  }

  private createBundleRequest(target: {
    packageName: string;
    kind?: ImportKind;
    namedImports?: string[];
    hasDefaultImport?: boolean;
    hasNamespaceImport?: boolean;
    isSideEffectOnly?: boolean;
    isExportAll?: boolean;
    isLocal?: boolean;
  }): BundleRequest | null {
    if (target.isLocal) {
      return null;
    }

    const moduleSpecifier = this.normalizeModuleSpecifier(target.packageName);
    if (!moduleSpecifier || moduleSpecifier.startsWith('node:')) {
      return null;
    }

    const kind: ImportKind = target.kind ?? 'import';
    const hasDefaultImport = !!target.hasDefaultImport;
    const hasNamespaceImport = !!target.hasNamespaceImport;
    const isExportAll = !!target.isExportAll;

    const namedImports = [...new Set(target.namedImports ?? [])]
      .filter((name) => name && name !== 'default')
      .sort();

    const runtimeSpecifierCount =
      (isExportAll ? 1 : 0) +
      (hasDefaultImport ? 1 : 0) +
      (hasNamespaceImport ? 1 : 0) +
      namedImports.length;
    const isSideEffectOnly = runtimeSpecifierCount === 0 || !!target.isSideEffectOnly;

    const idParts = [
      kind,
      moduleSpecifier,
      `all:${isExportAll ? 1 : 0}`,
      `default:${hasDefaultImport ? 1 : 0}`,
      `ns:${hasNamespaceImport ? 1 : 0}`,
      `side:${isSideEffectOnly ? 1 : 0}`,
      `named:${namedImports.join(',')}`,
    ];

    const entryContent = this.createEntryContent({
      kind,
      moduleSpecifier,
      isExportAll,
      hasDefaultImport,
      hasNamespaceImport,
      isSideEffectOnly,
      namedImports,
    });

    const displayName = this.createDisplayName({
      kind,
      moduleSpecifier,
      isExportAll,
      hasDefaultImport,
      hasNamespaceImport,
      isSideEffectOnly,
      namedImports,
    });

    return {
      id: idParts.join('|'),
      displayName,
      entryContent,
      versionPackageName: this.getRootPackageName(moduleSpecifier),
    };
  }

  private createEntryContent(target: {
    kind: ImportKind;
    moduleSpecifier: string;
    namedImports: string[];
    hasDefaultImport: boolean;
    hasNamespaceImport: boolean;
    isSideEffectOnly: boolean;
    isExportAll: boolean;
  }): string {
    const spec = JSON.stringify(target.moduleSpecifier);

    if (target.isExportAll) {
      return `export * from ${spec};`;
    }

    if (target.isSideEffectOnly) {
      return `import ${spec};`;
    }

    const lines: string[] = [];

    if (target.hasNamespaceImport) {
      lines.push(`import * as __bundleSizePlusNs from ${spec};`);
      lines.push('export { __bundleSizePlusNs };');
      return lines.join('\n');
    }

    if (target.hasDefaultImport) {
      lines.push(`export { default as __bundleSizePlusDefault } from ${spec};`);
    }

    if (target.namedImports.length > 0) {
      lines.push(`export { ${target.namedImports.join(', ')} } from ${spec};`);
    }

    return lines.join('\n');
  }

  private createDisplayName(target: {
    kind: ImportKind;
    moduleSpecifier: string;
    namedImports: string[];
    hasDefaultImport: boolean;
    hasNamespaceImport: boolean;
    isSideEffectOnly: boolean;
    isExportAll: boolean;
  }): string {
    const parts: string[] = [target.moduleSpecifier];

    if (target.isExportAll) {
      parts.push('(export *)');
      return parts.join(' ');
    }

    if (target.isSideEffectOnly) {
      parts.push('(side-effect)');
      return parts.join(' ');
    }

    if (target.hasNamespaceImport) {
      parts.push('(*)');
    }

    const named = [...target.namedImports];
    if (target.hasDefaultImport) {
      parts.push('(default)');
    }
    if (named.length > 0) {
      parts.push(`{ ${named.join(', ')} }`);
    }

    return parts.join(' ');
  }

  private normalizeModuleSpecifier(specifier: string): string {
    // Usually already normalized (AST string), but keep it defensive.
    let normalized = specifier.replace(/['"]/g, '');

    const queryIndex = normalized.indexOf('?');
    const hashIndex = normalized.indexOf('#');
    let end = normalized.length;

    if (queryIndex !== -1) {
      end = Math.min(end, queryIndex);
    }
    if (hashIndex !== -1) {
      end = Math.min(end, hashIndex);
    }

    normalized = normalized.slice(0, end);
    return normalized;
  }

  private getRootPackageName(moduleSpecifier: string): string | null {
    if (
      moduleSpecifier.startsWith('./') ||
      moduleSpecifier.startsWith('../') ||
      moduleSpecifier.startsWith('/') ||
      moduleSpecifier.startsWith('~/') ||
      moduleSpecifier.startsWith('@/') ||
      moduleSpecifier.startsWith('#/') ||
      moduleSpecifier.startsWith('node:')
    ) {
      return null;
    }

    const parts = moduleSpecifier.split('/');
    if (moduleSpecifier.startsWith('@')) {
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    }
    return parts[0] ?? null;
  }

  clearCache(): void {
    this.localBundler.clearCache();
  }

  formatSize(bytes: number): string {
    return this.localBundler.formatSize(bytes);
  }
}
