import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const backendDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(backendDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [resolve(backendDir, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  globalName: '_gasBundle',
  target: 'es2020',
  outfile: resolve(distDir, 'Code.js'),
  footer: {
    js: [
      '',
      'function doGet(e) {',
      '  return _gasBundle.doGet(e);',
      '}',
      '',
      'function doPost(e) {',
      '  return _gasBundle.doPost(e);',
      '}',
    ].join('\n'),
  },
});

copyFileSync(resolve(backendDir, 'appsscript.json'), resolve(distDir, 'appsscript.json'));
