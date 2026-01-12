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
        // Skip type-only imports (TypeScript)
        if ((node as any).importKind === 'type') {
          continue;
        }

        const packageName = node.source.value;
        const isLocal = isRelativeImport(packageName);

        const actualOffset = offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
        const position = document.positionAt(actualOffset);
        const lineEndPosition = document.lineAt(position.line).range.end;

        imports.push({
          packageName,
          position: lineEndPosition,
          line: position.line,
          isLocal,
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

        const actualOffset = offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
        const position = document.positionAt(actualOffset);
        const lineEndPosition = document.lineAt(position.line).range.end;

        imports.push({
          packageName,
          position: lineEndPosition,
          line: position.line,
          isLocal,
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

              const actualOffset =
                offset + (typeof (node as any).start === 'number' ? (node as any).start : 0);
              const position = document.positionAt(actualOffset);
              const lineEndPosition = document.lineAt(position.line).range.end;

              imports.push({
                packageName,
                position: lineEndPosition,
                line: position.line,
                isLocal,
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
