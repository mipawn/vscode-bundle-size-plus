import * as vscode from 'vscode';
import * as path from 'path';
import { BundleSizeProvider } from './BundleSizeProvider';
import { parseImports, ImportInfo } from '../parsers/ImportParser';
import { debounce, resolveImportPath, getLocalFileSize, getGzipSize } from '../utils/helpers';

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'vue',
  'svelte',
]);

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
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

    const decorations: vscode.DecorationOptions[] = [];
    const missingPackages = new Set<string>();

    for (const imp of visibleImports) {
      const range = new vscode.Range(imp.position, imp.position);

      const resolvedPath = resolveImportPath(imp.packageName, document.uri.fsPath, workspaceRoot);
      const isWorkspaceFile =
        !!workspaceRoot &&
        !!resolvedPath &&
        resolvedPath.startsWith(workspaceRoot) &&
        !resolvedPath.includes(`${path.sep}node_modules${path.sep}`);

      // Local or workspace-resolved import: show file size directly
      if (resolvedPath && (imp.isLocal || isWorkspaceFile)) {
        const size = getLocalFileSize(resolvedPath);
        const gzip = getGzipSize(resolvedPath);

        if (size !== null && gzip !== null) {
          const sizeLabel = this.bundleSizeProvider.formatSize(size);
          const gzipLabel = this.bundleSizeProvider.formatSize(gzip);

          decorations.push({
            range,
            renderOptions: { after: { contentText: ` ${sizeLabel} (${gzipLabel} zipped)` } },
            hoverMessage: new vscode.MarkdownString(
              `### Local Import\n\n` +
                `**Path:** \`${imp.packageName}\`\n\n` +
                `**Resolved:** \`${resolvedPath}\`\n\n` +
                `**File Size:** ${sizeLabel}\n` +
                `**Gzipped:** ${gzipLabel}`
            ),
          });
        }
        continue;
      }

      // Non-local or alias that didn't resolve as local: use bundlephobia
      const cached = this.bundleSizeProvider.getCachedPackageSize(imp.packageName);
      if (cached) {
        const minifiedSize = this.bundleSizeProvider.formatSize(cached.size);
        const gzippedSize = this.bundleSizeProvider.formatSize(cached.gzip);

        decorations.push({
          range,
          renderOptions: { after: { contentText: ` ${minifiedSize} (${gzippedSize} zipped)` } },
          hoverMessage: new vscode.MarkdownString(
            `### ${cached.name}\n\n` +
              `**Version:** ${cached.version}\n\n` +
              `**Sizes:**\n` +
              `- Minified: ${minifiedSize}\n` +
              `- Gzipped: ${gzippedSize}\n\n` +
              `[View on Bundlephobia](https://bundlephobia.com/package/${cached.name}@${cached.version})`
          ),
        });
      } else {
        // If we can resolve to a concrete file (e.g. node_modules subpath), show file size as a fast fallback.
        if (resolvedPath) {
          const size = getLocalFileSize(resolvedPath);
          const gzip = getGzipSize(resolvedPath);

          if (size !== null && gzip !== null) {
            const sizeLabel = this.bundleSizeProvider.formatSize(size);
            const gzipLabel = this.bundleSizeProvider.formatSize(gzip);

            decorations.push({
              range,
              renderOptions: { after: { contentText: ` ${sizeLabel} (${gzipLabel} zipped)` } },
              hoverMessage: new vscode.MarkdownString(
                `### Resolved Module\n\n` +
                  `**Import:** \`${imp.packageName}\`\n\n` +
                  `**Resolved:** \`${resolvedPath}\`\n\n` +
                  `**File Size:** ${sizeLabel}\n` +
                  `**Gzipped:** ${gzipLabel}\n\n` +
                  `_(Bundlephobia data not cached yet.)_`
              ),
            });
          }
        }

        // Trigger background fetch (deduped by BundleSizeProvider)
        missingPackages.add(imp.packageName);
      }
    }

    editor.setDecorations(this.decorationType, decorations);

    // Fetch missing packages in background and refresh once resolved
    for (const pkg of missingPackages) {
      void this.bundleSizeProvider.getPackageSize(pkg).then((result) => {
        if (result) {
          this.scheduleUpdate();
        }
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
