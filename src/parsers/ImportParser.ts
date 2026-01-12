import * as vscode from 'vscode';
import { parse as babelParse } from '@babel/parser';
import { parseVueScript } from './VueParser';
import { parseSvelteScript } from './SvelteParser';

export interface ImportInfo {
  packageName: string;
  position: vscode.Position;
  line: number;
}

export async function parseImports(document: vscode.TextDocument): Promise<ImportInfo[]> {
  const languageId = document.languageId;

  try {
    if (languageId === 'vue') {
      return await parseVueScript(document);
    } else if (languageId === 'svelte') {
      return await parseSvelteScript(document);
    } else {
      // JavaScript/TypeScript
      return parseJavaScriptImports(document);
    }
  } catch (error) {
    console.error(`Error parsing imports in ${languageId} file:`, error);
    return [];
  }
}

function parseJavaScriptImports(document: vscode.TextDocument): ImportInfo[] {
  const text = document.getText();
  const imports: ImportInfo[] = [];

  try {
    const ast = babelParse(text, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
    });

    for (const node of ast.program.body) {
      // Handle import declarations: import foo from 'package'
      if (node.type === 'ImportDeclaration' && node.source) {
        const packageName = node.source.value;

        // Skip relative imports
        if (isRelativeImport(packageName)) {
          continue;
        }

        const line = (node.loc?.start.line || 1) - 1;
        const position = document.lineAt(line).range.end;

        imports.push({
          packageName,
          position,
          line,
        });
      }

      // Handle require calls: const foo = require('package')
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

              // Skip relative imports
              if (isRelativeImport(packageName)) {
                continue;
              }

              const line = (node.loc?.start.line || 1) - 1;
              const position = document.lineAt(line).range.end;

              imports.push({
                packageName,
                position,
                line,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // If parsing fails, try regex fallback
    console.warn('Babel parsing failed, using regex fallback:', error);
    return parseImportsWithRegex(document);
  }

  return imports;
}

function parseImportsWithRegex(document: vscode.TextDocument): ImportInfo[] {
  const text = document.getText();
  const imports: ImportInfo[] = [];

  // Match import statements
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(text)) !== null) {
    const packageName = match[1];

    if (isRelativeImport(packageName)) {
      continue;
    }

    const position = document.positionAt(match.index + match[0].length);
    const line = position.line;

    imports.push({
      packageName,
      position: document.lineAt(line).range.end,
      line,
    });
  }

  // Match require statements
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(text)) !== null) {
    const packageName = match[1];

    if (isRelativeImport(packageName)) {
      continue;
    }

    const position = document.positionAt(match.index + match[0].length);
    const line = position.line;

    imports.push({
      packageName,
      position: document.lineAt(line).range.end,
      line,
    });
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
