import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(root, '..');
const watch = process.argv.includes('--watch');

/** NodeNext .js specifiers → .ts sources inside this workspace. */
const jsToTsPlugin = {
  name: 'js-ext-to-ts',
  setup(build) {
    build.onResolve({ filter: /.\.js$/ }, (args) => {
      if (!args.path.startsWith('.')) return undefined;
      const abs = path.join(args.resolveDir, args.path);
      const ts = abs.replace(/\.js$/, '.ts');
      if (fs.existsSync(ts)) return { path: ts };
      return undefined;
    });
  },
};

const options = {
  absWorkingDir: pkgRoot,
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  conditions: ['workerd', 'worker', 'browser'],
  mainFields: ['module', 'main'],
  external: ['cloudflare:workers'],
  plugins: [jsToTsPlugin],
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
