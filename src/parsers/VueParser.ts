import * as vscode from 'vscode';
import { parse as vueCompilerParse } from '@vue/compiler-sfc';
import { parse as babelParse } from '@babel/parser';
import { ImportInfo } from './ImportParser';

export async function parseVueScript(document: vscode.TextDocument): Promise<ImportInfo[]> {
  const text = document.getText();
  const imports: ImportInfo[] = [];

  try {
    // Parse Vue SFC
    const { descriptor, errors } = vueCompilerParse(text, {
      filename: document.fileName,
    });

    if (errors && errors.length > 0) {
      console.warn('Vue SFC parse warnings:', errors);
    }

    // Process <script> tag
    if (descriptor.script) {
      const scriptContent = descriptor.script.content;
      const scriptOffset = descriptor.script.loc.start.offset;

      const scriptImports = parseScriptContent(scriptContent, scriptOffset, document, descriptor.script.lang);
      console.log(`Found ${scriptImports.length} imports in <script> tag`);
      imports.push(...scriptImports);
    }

    // Process <script setup> tag
    if (descriptor.scriptSetup) {
      const scriptContent = descriptor.scriptSetup.content;
      const scriptOffset = descriptor.scriptSetup.loc.start.offset;

      const setupImports = parseScriptContent(scriptContent, scriptOffset, document, descriptor.scriptSetup.lang);
      console.log(`Found ${setupImports.length} imports in <script setup> tag`);
      imports.push(...setupImports);
    }

    if (imports.length === 0) {
      console.log('No imports found via Vue compiler, falling back to regex parsing');
      return parseVueScriptWithRegex(document);
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

  const pluginCandidates = getBabelParserPluginCandidates(lang);
  let ast: any | null = null;
  let lastError: unknown;

  for (const plugins of pluginCandidates) {
    try {
      ast = babelParse(content, {
        sourceType: 'module',
        plugins,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!ast) {
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn('Babel parsing failed for Vue <script> content, using regex fallback:', errorMessage);
    return parseScriptContentWithRegex(content, offset, document);
  }

    for (const node of ast.program.body) {
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
          continue;
        }

        const actualOffset = offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
        const position = document.positionAt(actualOffset);
        const lineEndPosition = document.lineAt(position.line).range.end;

        imports.push({
          packageName,
          position: lineEndPosition,
          line: position.line,
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
          continue;
        }

        const actualOffset = offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
        const position = document.positionAt(actualOffset);
        const lineEndPosition = document.lineAt(position.line).range.end;

        imports.push({
          packageName,
          position: lineEndPosition,
          line: position.line,
          isLocal,
          kind: 'export',
          namedImports,
          hasDefaultImport,
          hasNamespaceImport,
          isExportAll,
          isSideEffectOnly: runtimeSpecifierCount === 0,
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

              const actualOffset =
                offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
              const position = document.positionAt(actualOffset);
              const lineEndPosition = document.lineAt(position.line).range.end;

              imports.push({
                packageName,
                position: lineEndPosition,
                line: position.line,
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
  // Note: we intentionally avoid throwing here; per-block parsing failures fall back to regex.

  return imports;
}

function getBabelParserPluginCandidates(lang: string | undefined): any[][] {
  const normalizedLang = (lang ?? '').toLowerCase();
  const isTs = normalizedLang === 'ts' || normalizedLang === 'typescript';
  const isTsx = normalizedLang === 'tsx';
  const isJsx = normalizedLang === 'jsx';

  const basePlugins: any[] = [
    'decorators-legacy',
    'classProperties',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'importAssertions',
  ];

  const candidates: any[][] = [];
  const addCandidate = (plugins: any[]) => {
    const key = plugins.join(',');
    if (!candidates.some((existing) => existing.join(',') === key)) {
      candidates.push(plugins);
    }
  };

  if (isTsx) {
    addCandidate([...basePlugins, 'typescript', 'jsx']);
  } else if (isTs) {
    addCandidate([...basePlugins, 'typescript']);
  } else if (isJsx) {
    addCandidate([...basePlugins, 'jsx']);
  } else {
    // Default: allow JSX; many projects use JSX without `lang="jsx"`.
    addCandidate([...basePlugins, 'jsx']);
  }

  // Fallbacks: try TypeScript (with and without JSX) to support TS syntax in JS blocks.
  addCandidate([...basePlugins, 'typescript']);
  addCandidate([...basePlugins, 'typescript', 'jsx']);

  return candidates;
}

function parseScriptContentWithRegex(
  content: string,
  offset: number,
  document: vscode.TextDocument
): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Match import statements
  const importRegex =
    /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const actualOffset = offset + match.index + match[0].length;
    const position = document.positionAt(actualOffset);
    const lineEndPosition = document.lineAt(position.line).range.end;

    imports.push({
      packageName,
      position: lineEndPosition,
      line: position.line,
      isLocal,
      kind: 'import',
    });
  }

  // Match require statements
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(content)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const actualOffset = offset + match.index + match[0].length;
    const position = document.positionAt(actualOffset);
    const lineEndPosition = document.lineAt(position.line).range.end;

    imports.push({
      packageName,
      position: lineEndPosition,
      line: position.line,
      isLocal,
      kind: 'require',
    });
  }

  // Match export ... from statements
  const exportRegex =
    /export\s+(?:type\s+)?(?:\*\s+from|\{[\s\S]*?\}\s+from)\s+['"]([^'"]+)['"]/g;

  while ((match = exportRegex.exec(content)) !== null) {
    const packageName = match[1];
    const isLocal = isRelativeImport(packageName);

    const actualOffset = offset + match.index + match[0].length;
    const position = document.positionAt(actualOffset);
    const lineEndPosition = document.lineAt(position.line).range.end;

    imports.push({
      packageName,
      position: lineEndPosition,
      line: position.line,
      isLocal,
      kind: 'export',
    });
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
    const importRegex =
      /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(scriptContent)) !== null) {
      const packageName = match[1];
      const isLocal = isRelativeImport(packageName);

      const actualOffset = scriptStart + match.index + match[0].length;
      const position = document.positionAt(actualOffset);
      const lineEndPosition = document.lineAt(position.line).range.end;

      imports.push({
        packageName,
        position: lineEndPosition,
        line: position.line,
        isLocal,
        kind: 'import',
      });
    }

    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = requireRegex.exec(scriptContent)) !== null) {
      const packageName = match[1];
      const isLocal = isRelativeImport(packageName);

      const actualOffset = scriptStart + match.index + match[0].length;
      const position = document.positionAt(actualOffset);
      const lineEndPosition = document.lineAt(position.line).range.end;

      imports.push({
        packageName,
        position: lineEndPosition,
        line: position.line,
        isLocal,
        kind: 'require',
      });
    }

    // Match export ... from statements
    const exportRegex =
      /export\s+(?:type\s+)?(?:\*\s+from|\{[\s\S]*?\}\s+from)\s+['"]([^'"]+)['"]/g;

    while ((match = exportRegex.exec(scriptContent)) !== null) {
      const packageName = match[1];
      const isLocal = isRelativeImport(packageName);

      const actualOffset = scriptStart + match.index + match[0].length;
      const position = document.positionAt(actualOffset);
      const lineEndPosition = document.lineAt(position.line).range.end;

      imports.push({
        packageName,
        position: lineEndPosition,
        line: position.line,
        isLocal,
        kind: 'export',
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
    packageName.startsWith('~/') ||
    packageName.startsWith('@/') ||
    packageName.startsWith('#/')
  );
}
