import * as vscode from 'vscode';
import { parse as vueCompilerParse } from '@vue/compiler-sfc';
import { parse as babelParse } from '@babel/parser';
import { ImportInfo } from './ImportParser';

export async function parseVueScript(document: vscode.TextDocument): Promise<ImportInfo[]> {
  const text = document.getText();
  const imports: ImportInfo[] = [];

  try {
    // Parse Vue SFC
    const { descriptor } = vueCompilerParse(text, {
      filename: document.fileName,
    });

    // Process <script> tag
    if (descriptor.script) {
      const scriptContent = descriptor.script.content;
      const scriptOffset = descriptor.script.loc.start.offset;

      imports.push(...parseScriptContent(scriptContent, scriptOffset, document, descriptor.script.lang));
    }

    // Process <script setup> tag
    if (descriptor.scriptSetup) {
      const scriptContent = descriptor.scriptSetup.content;
      const scriptOffset = descriptor.scriptSetup.loc.start.offset;

      imports.push(...parseScriptContent(scriptContent, scriptOffset, document, descriptor.scriptSetup.lang));
    }
  } catch (error) {
    console.error('Error parsing Vue file:', error);
    // Fallback to regex-based parsing
    return parseVueScriptWithRegex(document);
  }

  return imports;
}

function parseScriptContent(
  content: string,
  offset: number,
  document: vscode.TextDocument,
  lang: string | undefined
): ImportInfo[] {
  const imports: ImportInfo[] = [];

  try {
    // Determine parser plugins based on language
    const plugins: any[] = ['dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom'];

    if (lang === 'ts' || lang === 'typescript') {
      plugins.push('typescript', 'decorators-legacy');
    } else {
      plugins.push('jsx');
    }

    const ast = babelParse(content, {
      sourceType: 'module',
      plugins,
    });

    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration' && node.source) {
        const packageName = node.source.value;

        // Skip relative imports
        if (isRelativeImport(packageName)) {
          continue;
        }

        // Calculate actual position in the document
        const nodeStart = node.loc?.start.offset || 0;
        const actualOffset = offset + nodeStart;
        const position = document.positionAt(actualOffset);
        const lineEndPosition = document.lineAt(position.line).range.end;

        imports.push({
          packageName,
          position: lineEndPosition,
          line: position.line,
        });
      }

      // Handle require calls
      if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
          if (
            declaration.init &&
            declaration.init.type === 'CallExpression' &&
            declaration.init.callee.type === 'Identifier' &&
            declaration.init.callee.name === 'require' &&
            declaration.init.arguments.length > 0
          ) {
            const arg = declaration.init.arguments[0];
            if (arg.type === 'StringLiteral') {
              const packageName = arg.value;

              if (isRelativeImport(packageName)) {
                continue;
              }

              const nodeStart = node.loc?.start.offset || 0;
              const actualOffset = offset + nodeStart;
              const position = document.positionAt(actualOffset);
              const lineEndPosition = document.lineAt(position.line).range.end;

              imports.push({
                packageName,
                position: lineEndPosition,
                line: position.line,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing script content with Babel:', error);
  }

  return imports;
}

function parseVueScriptWithRegex(document: vscode.TextDocument): ImportInfo[] {
  const text = document.getText();
  const imports: ImportInfo[] = [];

  // Find script tags
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;

  while ((scriptMatch = scriptRegex.exec(text)) !== null) {
    const scriptContent = scriptMatch[1];
    const scriptStart = scriptMatch.index + scriptMatch[0].indexOf(scriptContent);

    // Match import statements
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(scriptContent)) !== null) {
      const packageName = match[1];

      if (isRelativeImport(packageName)) {
        continue;
      }

      const actualOffset = scriptStart + match.index + match[0].length;
      const position = document.positionAt(actualOffset);
      const lineEndPosition = document.lineAt(position.line).range.end;

      imports.push({
        packageName,
        position: lineEndPosition,
        line: position.line,
      });
    }

    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = requireRegex.exec(scriptContent)) !== null) {
      const packageName = match[1];

      if (isRelativeImport(packageName)) {
        continue;
      }

      const actualOffset = scriptStart + match.index + match[0].length;
      const position = document.positionAt(actualOffset);
      const lineEndPosition = document.lineAt(position.line).range.end;

      imports.push({
        packageName,
        position: lineEndPosition,
        line: position.line,
      });
    }
  }

  return imports;
}

function isRelativeImport(packageName: string): boolean {
  return (
    packageName.startsWith('./') ||
    packageName.startsWith('../') ||
    packageName.startsWith('/') ||
    packageName.startsWith('~/')
  );
}
