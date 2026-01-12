import * as vscode from 'vscode';
import { BundleSizeProvider } from './BundleSizeProvider';
import { parseImports } from '../parsers/ImportParser';
import { resolveImportPath, getLocalFileSize, getGzipSize } from '../utils/helpers';

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

        // Handle local imports
        if (imp.isLocal) {
          const resolvedPath = resolveImportPath(imp.packageName, document.uri.fsPath);
          if (resolvedPath) {
            const fileSize = getLocalFileSize(resolvedPath);
            const gzipSize = getGzipSize(resolvedPath);

            if (fileSize !== null && gzipSize !== null) {
              const fileSizeLabel = this.bundleSizeProvider.formatSize(fileSize);
              const gzipSizeLabel = this.bundleSizeProvider.formatSize(gzipSize);

              const label = new vscode.InlayHintLabelPart(` ${fileSizeLabel} (${gzipSizeLabel} zipped)`);
              label.tooltip = new vscode.MarkdownString(
                `### Local Import\n\n` +
                  `**Path:** \`${imp.packageName}\`\n\n` +
                  `**Resolved:** \`${resolvedPath}\`\n\n` +
                  `**File Size:** ${fileSizeLabel}\n` +
                  `**Gzipped:** ${gzipSizeLabel}`
              );

              const hint = new vscode.InlayHint(
                imp.position,
                [label],
                vscode.InlayHintKind.Parameter
              );

              hint.paddingLeft = true;

              hints.push(hint);
            }
          }
          continue;
        }

        // Handle npm packages
        const sizeInfo = await this.bundleSizeProvider.getPackageSize(imp.packageName);

        if (sizeInfo) {
          const showGzip = config.get('showGzipSize', true);
          const size = showGzip ? sizeInfo.gzip : sizeInfo.size;

          // Check if we should only show large packages
          const showOnlyLarge = config.get('showOnlyLargePackages', false);
          const threshold = config.get('largePackageThreshold', 50000);

          if (showOnlyLarge && size < threshold) {
            continue;
          }

          const minifiedSize = this.bundleSizeProvider.formatSize(sizeInfo.size);
          const gzippedSize = this.bundleSizeProvider.formatSize(sizeInfo.gzip);

          const label = new vscode.InlayHintLabelPart(` ${minifiedSize} (${gzippedSize} zipped)`);
          label.tooltip = new vscode.MarkdownString(
            `### ${imp.packageName}\n\n` +
              `**Version:** ${sizeInfo.version}\n\n` +
              `**Sizes:**\n` +
              `- Minified: ${minifiedSize}\n` +
              `- Gzipped: ${gzippedSize}\n\n` +
              `[View on Bundlephobia](https://bundlephobia.com/package/${imp.packageName}@${sizeInfo.version})`
          );

          const hint = new vscode.InlayHint(
            imp.position,
            [label],
            vscode.InlayHintKind.Parameter
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
