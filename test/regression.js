const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const { BundleSizeProvider } = require(path.join(repoRoot, 'dist/providers/BundleSizeProvider'));
const { LocalBundler } = require(path.join(repoRoot, 'dist/bundler/LocalBundler'));

function symlinkDir(target, linkPath) {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, type);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-size-plus-'));
  try {
    writeFile(
      path.join(tmpRoot, 'package.json'),
      JSON.stringify({ name: 'bundle-size-plus-test', private: true }, null, 2)
    );

    const nodeModulesDir = path.join(tmpRoot, 'node_modules');
    fs.mkdirSync(nodeModulesDir, { recursive: true });

    // Ensure LocalBundler can load esbuild from the workspace root.
    symlinkDir(path.join(repoRoot, 'node_modules', 'esbuild'), path.join(nodeModulesDir, 'esbuild'));

    // Fake dependency inside node_modules that imports a missing optional dep.
    const fakePkgName = '__bundle_size_plus_test_pkg__';
    writeFile(
      path.join(nodeModulesDir, fakePkgName, 'index.js'),
      `import 'missing-dep';\nexport const value = 1;\n`
    );

    // Fake nested dependency (transitive) that only exists under another package's node_modules.
    const nestedPkgA = '__bundle_size_plus_test_nested_a__';
    const nestedPkgB = '__bundle_size_plus_test_nested_b__';
    writeFile(
      path.join(nodeModulesDir, nestedPkgA, 'index.js'),
      `export { value } from '${nestedPkgB}';\n`
    );
    writeFile(
      path.join(nodeModulesDir, nestedPkgA, 'node_modules', nestedPkgB, 'index.js'),
      `const big = '${'x'.repeat(20000)}';\nexport function value() { return big.length; }\n`
    );

    const bundler = new LocalBundler();

    // 1) Should not fail on node: protocol imports (externalized).
    {
      const result = await bundler.getBundleSize(
        {
          id: 'node-protocol',
          displayName: 'node-protocol',
          entryContent: `import path from 'node:path'; export { path };`,
          versionPackageName: null,
        },
        tmpRoot
      );
      assert(result, 'expected node: protocol bundle to succeed');
    }

    // 2) Should not fail on missing optional deps referenced from node_modules.
    {
      const result = await bundler.getBundleSize(
        {
          id: 'missing-optional',
          displayName: 'missing-optional',
          entryContent: `export * from '${fakePkgName}';`,
          versionPackageName: null,
        },
        tmpRoot
      );
      assert(result, 'expected missing optional dep bundle to succeed');
    }

    // 3) Should not mistakenly externalize transitive deps (pnpm-style nested node_modules).
    {
      const result = await bundler.getBundleSize(
        {
          id: 'nested-transitive',
          displayName: 'nested-transitive',
          entryContent: `export { value } from '${nestedPkgA}';`,
          versionPackageName: null,
        },
        tmpRoot
      );
      assert(result, 'expected nested transitive dep bundle to succeed');
      assert(result.size > 15000, 'expected nested dependency content to be bundled');
    }

    // 4) Should bundle local imports when resolvedPath is provided.
    {
      const localFile = path.join(tmpRoot, 'src', 'local.ts');
      writeFile(localFile, `export const foo = 'bar';\n`);

      const provider = new BundleSizeProvider();
      const localImport = {
        packageName: '@/src/local',
        isLocal: true,
        kind: 'import',
        namedImports: ['foo'],
        resolvedPath: localFile,
      };

      const cacheId = provider.getImportCacheId(localImport);
      assert(cacheId, 'expected cache id for resolved local import');

      const size = await provider.getImportSize(localImport, tmpRoot);
      assert(size, 'expected local import bundling result');
      assert.strictEqual(size.version, 'local');
    }

    // 5) Local import without resolvedPath should be rejected (needs resolution for stdin bundling).
    {
      const provider = new BundleSizeProvider();
      const localImport = {
        packageName: './nope',
        isLocal: true,
        kind: 'import',
        namedImports: ['x'],
      };
      const cacheId = provider.getImportCacheId(localImport);
      assert.strictEqual(cacheId, null);
    }

    console.log('All regression tests passed.');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
