import * as vscode from 'vscode';
import { parse as babelParse } from '@babel/parser';
import { parseVueScript } from './VueParser';
import { parseSvelteScript } from './SvelteParser';

export type ImportKind = 'import' | 'export' | 'require';

export interface ImportInfo {
  packageName: string;
  position: vscode.Position;
  line: number;
  isLocal?: boolean; // Flag to indicate if this is a local import
  /**
   * Absolute path for workspace/local imports when the UI layer resolves them.
   * Used to enable accurate bundling of local modules via esbuild.
   */
  resolvedPath?: string;

  /**
   * What kind of statement produced this import.
   * Used to generate a more precise local-bundling entry for size calculation.
   */
  kind?: ImportKind;

  /**
   * Named members imported/exported via `{ foo, bar }`.
   * These are *export names* from the module (aliases are ignored).
   */
  namedImports?: string[];

  hasDefaultImport?: boolean;
  hasNamespaceImport?: boolean;
  isSideEffectOnly?: boolean;
  isExportAll?: boolean;
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
        // Skip type-only imports (TypeScript)
        if ((node as any).importKind === 'type') {
          continue;
        }

        const packageName = node.source.value;
        const isLocal = isRelativeImport(packageName);

        const namedImports: string[] = [];
        let hasDefaultImport = false;
        let hasNamespaceImport = false;

        for (const specifier of node.specifiers) {
          if ((specifier as any).importKind === 'type') {
            continue;
          }

          if (specifier.type === 'ImportDefaultSpecifier') {
            hasDefaultImport = true;
            continue;
          }

          if (specifier.type === 'ImportNamespaceSpecifier') {
            hasNamespaceImport = true;
            continue;
          }

          if (specifier.type === 'ImportSpecifier') {
            const imported = (specifier as any).imported;
            const importedName =
              imported?.type === 'Identifier'
                ? imported.name
                : imported?.type === 'StringLiteral'
                  ? imported.value
                  : null;

            if (!importedName) {
              continue;
            }

            if (importedName === 'default') {
              hasDefaultImport = true;
              continue;
            }

            namedImports.push(importedName);
          }
        }

        const runtimeSpecifierCount =
          (hasDefaultImport ? 1 : 0) + (hasNamespaceImport ? 1 : 0) + namedImports.length;
        if (runtimeSpecifierCount === 0 && node.specifiers.length > 0) {
          // e.g. `import { type Foo } from 'x'`
          continue;
        }

        const line = (node.loc?.start.line || 1) - 1;
        const position = document.lineAt(line).range.end;

        imports.push({
          packageName,
          position,
          line,
          isLocal,
          kind: 'import',
          namedImports,
          hasDefaultImport,
          hasNamespaceImport,
          isSideEffectOnly: runtimeSpecifierCount === 0,
        });
      }

      // Handle export declarations with source: export * from 'package'
      if (
        (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
        (node as any).source
      ) {
        // Skip type-only exports (TypeScript)
        if ((node as any).exportKind === 'type') {
          continue;
        }

        const packageName = (node as any).source.value;
        const isLocal = isRelativeImport(packageName);

        const namedImports: string[] = [];
        let hasDefaultImport = false;
        let hasNamespaceImport = false;
        const isExportAll = node.type === 'ExportAllDeclaration';

        if (!isExportAll) {
          for (const specifier of (node as any).specifiers ?? []) {
            if ((specifier as any).exportKind === 'type') {
              continue;
            }

            if (specifier.type === 'ExportNamespaceSpecifier') {
              hasNamespaceImport = true;
              continue;
            }

            if (specifier.type === 'ExportSpecifier') {
              const local = (specifier as any).local;
              const localName =
                local?.type === 'Identifier'
                  ? local.name
                  : local?.type === 'StringLiteral'
                    ? local.value
                    : null;

              if (!localName) {
                continue;
              }

              if (localName === 'default') {
                hasDefaultImport = true;
                continue;
              }

              namedImports.push(localName);
            }
          }
        }

        const runtimeSpecifierCount =
          (isExportAll ? 1 : 0) +
          (hasDefaultImport ? 1 : 0) +
          (hasNamespaceImport ? 1 : 0) +
          namedImports.length;
        if (runtimeSpecifierCount === 0 && ((node as any).specifiers?.length ?? 0) > 0) {
          // e.g. `export { type Foo } from 'x'`
          continue;
        }

        const line = (node.loc?.start.line || 1) - 1;
        const position = document.lineAt(line).range.end;

        imports.push({
          packageName,
          position,
          line,
          isLocal,
          kind: 'export',
          namedImports,
          hasDefaultImport,
          hasNamespaceImport,
          isExportAll,
          isSideEffectOnly: runtimeSpecifierCount === 0,
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
              const isLocal = isRelativeImport(packageName);

              const namedImports: string[] = [];
              let hasNamespaceImport = false;

              if (declaration.id.type === 'ObjectPattern') {
                for (const prop of declaration.id.properties) {
                  if (prop.type !== 'ObjectProperty') {
                    continue;
                  }
                  const key: any = prop.key;
                  const keyName =
                    key?.type === 'Identifier'
                      ? key.name
                      : key?.type === 'StringLiteral'
                        ? key.value
                        : null;
                  if (keyName) {
                    namedImports.push(keyName);
                  }
                }
              } else if (declaration.id.type === 'Identifier') {
                hasNamespaceImport = true;
              }

              const line = (node.loc?.start.line || 1) - 1;
              const position = document.lineAt(line).range.end;

              imports.push({
                packageName,
                position,
                line,
                isLocal,
                kind: 'require',
                namedImports,
                hasNamespaceImport,
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
  const importRegex =
    /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(text)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const position = document.positionAt(match.index + match[0].length);
    const line = position.line;

    imports.push({
      packageName,
      position: document.lineAt(line).range.end,
      line,
      isLocal,
      kind: 'import',
    });
  }

  // Match require statements
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(text)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const position = document.positionAt(match.index + match[0].length);
    const line = position.line;

    imports.push({
      packageName,
      position: document.lineAt(line).range.end,
      line,
      isLocal,
      kind: 'require',
    });
  }

  // Match export ... from statements
  const exportRegex =
    /export\s+(?:type\s+)?(?:\*\s+from|\{[\s\S]*?\}\s+from)\s+['"]([^'"]+)['"]/g;

  while ((match = exportRegex.exec(text)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const position = document.positionAt(match.index + match[0].length);
    const line = position.line;

    imports.push({
      packageName,
      position: document.lineAt(line).range.end,
      line,
      isLocal,
      kind: 'export',
    });
  }

  return imports;
}

function isRelativeImport(packageName: string): boolean {
  return (
    packageName.startsWith('./') ||
    packageName.startsWith('../') ||
    packageName.startsWith('/') ||
    packageName.startsWith('~/') ||
    packageName.startsWith('@/') ||
    packageName.startsWith('#/')
  );
}
