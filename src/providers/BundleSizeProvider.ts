import * as vscode from 'vscode';
import axios from 'axios';

interface PackageSizeInfo {
  name: string;
  size: number;
  gzip: number;
  version: string;
}

interface CacheEntry {
  data: PackageSizeInfo;
  timestamp: number;
}

export class BundleSizeProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<PackageSizeInfo | null>> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Load cache from global state
    const savedCache = context.globalState.get<Record<string, CacheEntry>>('bundleSizeCache', {});
    this.cache = new Map(Object.entries(savedCache));
  }

  async getPackageSize(packageName: string): Promise<PackageSizeInfo | null> {
    // Clean package name (remove version specifiers, scopes, etc.)
    const cleanName = this.cleanPackageName(packageName);

    // Check cache first
    const cached = this.getCachedSize(cleanName);
    if (cached) {
      return cached;
    }

    // Check if there's already a pending request for this package
    const pending = this.pendingRequests.get(cleanName);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = this.fetchPackageSize(cleanName);
    this.pendingRequests.set(cleanName, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(cleanName);
    }
  }

  private getCachedSize(packageName: string): PackageSizeInfo | null {
    const cached = this.cache.get(packageName);
    if (!cached) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('bundleSizePlus');
    const cacheDuration = config.get('cacheDuration', 86400000); // Default: 24 hours

    const now = Date.now();
    if (now - cached.timestamp > cacheDuration) {
      this.cache.delete(packageName);
      return null;
    }

    return cached.data;
  }

  private async fetchPackageSize(packageName: string): Promise<PackageSizeInfo | null> {
    try {
      const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(packageName)}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'vscode-bundle-size-plus',
        },
      });

      const data: PackageSizeInfo = {
        name: response.data.name || packageName,
        size: response.data.size || 0,
        gzip: response.data.gzip || 0,
        version: response.data.version || 'latest',
      };

      // Cache the result
      this.cacheSize(packageName, data);

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log(`Package not found: ${packageName}`);
        } else {
          console.error(`Error fetching size for ${packageName}:`, error.message);
        }
      } else {
        console.error(`Unexpected error fetching size for ${packageName}:`, error);
      }
      return null;
    }
  }

  private cacheSize(packageName: string, data: PackageSizeInfo): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };

    this.cache.set(packageName, entry);

    // Save to global state (async, no need to await)
    const cacheObject = Object.fromEntries(this.cache.entries());
    this.context.globalState.update('bundleSizeCache', cacheObject);
  }

  private cleanPackageName(packageName: string): string {
    // Remove quotes
    let cleaned = packageName.replace(/['"]/g, '');

    // Remove relative/absolute path indicators
    cleaned = cleaned.replace(/^[./~]/, '');

    // For scoped packages (@org/package), keep the scope
    // For regular packages, just use the package name
    const parts = cleaned.split('/');

    if (cleaned.startsWith('@') && parts.length >= 2) {
      // Scoped package: @org/package
      return `${parts[0]}/${parts[1]}`;
    } else {
      // Regular package: just the first part
      return parts[0];
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.context.globalState.update('bundleSizeCache', {});
  }

  formatSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
