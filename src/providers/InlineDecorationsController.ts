import * as vscode from 'vscode';
import * as path from 'path';
import { BundleSizeProvider } from './BundleSizeProvider';
import { parseImports, ImportInfo } from '../parsers/ImportParser';
import { debounce, resolveImportPath, getLocalFileSize, getGzipSize, getProjectRootForFile } from '../utils/helpers';

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'vue',
  'svelte',
]);

const WARNING_SIZE_BYTES = 100 * 1024;
const ERROR_SIZE_BYTES = 500 * 1024;

export class InlineDecorationsController implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly importCache = new Map<string, { version: number; imports: ImportInfo[] }>();

  private readonly scheduleUpdate: () => void;
  private updateRunId = 0;

  constructor(private readonly bundleSizeProvider: BundleSizeProvider) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('bundleSizePlus.inlayHint'),
        margin: '0 0 0 1.5rem',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    this.scheduleUpdate = debounce(() => {
      void this.updateVisibleEditors();
    }, 200);
  }

  start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.scheduleUpdate()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.scheduleUpdate()),
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
        // We only compute decorations for visible imports, so scrolling must trigger a refresh.
        if (vscode.window.visibleTextEditors.includes(e.textEditor)) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === doc)) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === doc)) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.importCache.delete(doc.uri.toString());
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('bundleSizePlus')) {
          this.scheduleUpdate();
        }
      })
    );

    this.scheduleUpdate();
  }

  refresh(): void {
    this.scheduleUpdate();
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.decorationType.dispose();
  }

  private getHintColor(bytes: number): vscode.ThemeColor {
    if (bytes >= ERROR_SIZE_BYTES) {
      return new vscode.ThemeColor('bundleSizePlus.inlayHintHeavy');
    }
    if (bytes >= WARNING_SIZE_BYTES) {
      return new vscode.ThemeColor('bundleSizePlus.inlayHintWarning');
    }
    return new vscode.ThemeColor('bundleSizePlus.inlayHint');
  }

  private async updateVisibleEditors(): Promise<void> {
    const runId = ++this.updateRunId;
    const editors = vscode.window.visibleTextEditors;

    await Promise.all(
      editors.map(async (editor) => {
        if (runId !== this.updateRunId) {
          return;
        }
        await this.updateEditor(editor);
      })
    );
  }

  private async updateEditor(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const key = document.uri.toString();

    if (document.uri.scheme !== 'file' || !SUPPORTED_LANGUAGES.has(document.languageId)) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const config = vscode.workspace.getConfiguration('bundleSizePlus');
    const enabled = config.get('enableInlayHints', true);
    if (!enabled) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const imports = await this.getCachedImports(document, key);
    const visibleImports = this.filterVisibleImports(imports, editor);
    const workspaceFolderRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    const workspaceRoot = getProjectRootForFile(document.uri.fsPath, workspaceFolderRoot);
    const bundlingAvailable = this.bundleSizeProvider.isBundlingAvailable(workspaceRoot);

    const decorations: vscode.DecorationOptions[] = [];
    const missingImports = new Map<string, ImportInfo>();

    for (const imp of visibleImports) {
      const range = new vscode.Range(imp.position, imp.position);

      const resolvedPath = resolveImportPath(imp.packageName, document.uri.fsPath, workspaceRoot);
      const isWorkspaceFile =
        !!workspaceRoot &&
        !!resolvedPath &&
        resolvedPath.startsWith(workspaceRoot) &&
        !resolvedPath.includes(`${path.sep}node_modules${path.sep}`);

      const shouldBundleResolvedPath = !!resolvedPath && (imp.isLocal || isWorkspaceFile);
      const bundleTarget: ImportInfo = shouldBundleResolvedPath ? { ...imp, resolvedPath } : imp;

      // Use local bundler to calculate size when possible (including workspace files when resolved)
      const cached = this.bundleSizeProvider.getCachedImportSize(bundleTarget, workspaceRoot);
      if (cached) {
        const minifiedSize = this.bundleSizeProvider.formatSize(cached.size);
        const gzippedSize = this.bundleSizeProvider.formatSize(cached.gzip);
        const resolvedLine = resolvedPath ? `**Resolved:** \`${resolvedPath}\`\n\n` : '';
        const hintColor = this.getHintColor(cached.size);

        decorations.push({
          range,
          renderOptions: { after: { contentText: ` ${minifiedSize} (${gzippedSize} zipped)`, color: hintColor } },
          hoverMessage: new vscode.MarkdownString(
            `### ${cached.name}\n\n` +
              `**Import:** \`${imp.packageName}\`\n\n` +
              resolvedLine +
              `**Version:** ${cached.version}\n\n` +
              `**Sizes (bundled with esbuild):**\n` +
              `- Minified: ${minifiedSize}\n` +
              `- Gzipped: ${gzippedSize}\n\n` +
              `_Size calculated by local bundling_`
          ),
        });
      } else {
        const cacheState = this.bundleSizeProvider.getImportCacheState(bundleTarget, workspaceRoot);

        // If we can resolve to a concrete file, show file size as a fast fallback.
        if (resolvedPath) {
          const size = getLocalFileSize(resolvedPath);
          const gzip = getGzipSize(resolvedPath);

          if (size !== null && gzip !== null) {
            const sizeLabel = this.bundleSizeProvider.formatSize(size);
            const gzipLabel = this.bundleSizeProvider.formatSize(gzip);
            const hintColor = this.getHintColor(size);

            let bundleNote = '_(Bundle size being calculated...)_';
            if (!workspaceRoot) {
              bundleNote = '_(Bundle size unavailable: open a workspace folder)_';
            } else if (!bundlingAvailable) {
              bundleNote =
                '_(Bundle size unavailable: install `esbuild` in your project or globally; see Output → Bundle Size Plus)_';
            } else if (cacheState === 'failed') {
              bundleNote =
                '_(Bundle size calculation failed recently; showing resolved file size)_';
            } else if (cacheState === 'pending') {
              bundleNote = '_(Bundle size being calculated...)_';
            }

            const resolvedHeader = imp.isLocal || isWorkspaceFile ? 'Workspace Module' : 'Resolved Module';
            decorations.push({
              range,
              renderOptions: {
                after: { contentText: ` ${sizeLabel} (${gzipLabel} zipped) (resolved)`, color: hintColor },
              },
              hoverMessage: new vscode.MarkdownString(
                `### ${resolvedHeader}\n\n` +
                  `**Import:** \`${imp.packageName}\`\n\n` +
                  `**Resolved:** \`${resolvedPath}\`\n\n` +
                  `**File Size:** ${sizeLabel}\n` +
                  `**Gzipped:** ${gzipLabel}\n\n` +
                  `${bundleNote}`
              ),
            });
          }
        } else if (workspaceRoot && bundlingAvailable) {
          // We can't resolve a concrete file path (e.g. ESM-only exports), but still show that we're working.
          const pendingNote =
            cacheState === 'failed'
              ? ' (bundle failed)'
              : cacheState === 'pending'
                ? ' (bundling...)'
                : cacheState === 'missing'
                  ? ' (bundling...)'
                  : '';
          if (pendingNote) {
            decorations.push({
              range,
              renderOptions: { after: { contentText: pendingNote } },
              hoverMessage: new vscode.MarkdownString(
                `### Bundle Size\n\n` +
                  `**Import:** \`${imp.packageName}\`\n\n` +
                  `_(Bundling with esbuild)_`
              ),
            });
          }
        }

        // Trigger background build (deduped by LocalBundler)
        const cacheId = this.bundleSizeProvider.getImportCacheId(bundleTarget);
        if (cacheId && workspaceRoot && bundlingAvailable && cacheState === 'missing') {
          missingImports.set(cacheId, bundleTarget);
        }
      }
    }

    editor.setDecorations(this.decorationType, decorations);

    // Build missing packages in background and refresh once resolved
    for (const imp of missingImports.values()) {
      void this.bundleSizeProvider.getImportSize(imp, workspaceRoot).then(() => {
        this.scheduleUpdate();
      });
    }
  }

  private async getCachedImports(document: vscode.TextDocument, key: string): Promise<ImportInfo[]> {
    const cached = this.importCache.get(key);
    if (cached && cached.version === document.version) {
      return cached.imports;
    }

    const imports = await parseImports(document);
    this.importCache.set(key, { version: document.version, imports });
    return imports;
  }

  private filterVisibleImports(imports: ImportInfo[], editor: vscode.TextEditor): ImportInfo[] {
    if (editor.visibleRanges.length === 0) {
      return imports;
    }

    const ranges = editor.visibleRanges.map((r) => ({ start: r.start.line, end: r.end.line }));
    return imports.filter((imp) => ranges.some((r) => imp.line >= r.start && imp.line <= r.end));
  }
}
