import * as vscode from 'vscode';
import { BundleSizeProvider } from './BundleSizeProvider';
import { parseImports } from '../parsers/ImportParser';

export class InlayHintsProvider implements vscode.InlayHintsProvider {
  constructor(private bundleSizeProvider: BundleSizeProvider) {}

  async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const config = vscode.workspace.getConfiguration('bundleSizePlus');
    const enabled = config.get('enableInlayHints', true);

    if (!enabled) {
      return [];
    }

    const hints: vscode.InlayHint[] = [];

    try {
      // Parse imports from the document
      const imports = await parseImports(document);

      // Filter imports within the requested range
      const visibleImports = imports.filter((imp) => range.contains(imp.position));

      // Fetch sizes for each import
      for (const imp of visibleImports) {
        if (token.isCancellationRequested) {
          break;
        }

        const sizeInfo = await this.bundleSizeProvider.getPackageSize(imp.packageName);

        if (sizeInfo) {
          const showGzip = config.get('showGzipSize', true);
          const size = showGzip ? sizeInfo.gzip : sizeInfo.size;
          const sizeLabel = this.bundleSizeProvider.formatSize(size);
          const sizeType = showGzip ? 'gzipped' : 'minified';

          const hint = new vscode.InlayHint(
            imp.position,
            ` 📦 ${sizeLabel} (${sizeType})`,
            vscode.InlayHintKind.Parameter
          );

          hint.tooltip = new vscode.MarkdownString(
            `**${imp.packageName}** v${sizeInfo.version}\n\n` +
              `- Minified: ${this.bundleSizeProvider.formatSize(sizeInfo.size)}\n` +
              `- Gzipped: ${this.bundleSizeProvider.formatSize(sizeInfo.gzip)}`
          );

          hint.paddingLeft = true;

          hints.push(hint);
        }
      }
    } catch (error) {
      console.error('Error providing inlay hints:', error);
    }

    return hints;
  }
}
