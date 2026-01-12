const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
  external: [
    'vscode',
    // Optional dependencies from @vue/compiler-sfc that we don't need
    'velocityjs', 'dustjs-linkedin', 'atpl', 'liquor', 'twig', 'ejs', 'eco',
    'jazz', 'jqtpl', 'hamljs', 'hamlet', 'whiskers', 'haml-coffee', 'hogan.js',
    'templayed', 'handlebars', 'underscore', 'lodash', 'pug', 'then-pug',
    'qejs', 'walrus', 'mustache', 'just', 'ect', 'mote', 'toffee', 'dot',
    'bracket-template', 'ractive', 'nunjucks', 'htmling', 'babel-core',
    '@babel/core', 'plates', 'react-dom/server', 'react', 'arc-templates',
    'vash', 'slm', 'marko', 'teacup/lib/express', 'coffee-script',
    'squirrelly', 'twing'
  ],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build completed successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
