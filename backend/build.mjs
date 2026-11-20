import { copyFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: '_gasBundle',
  target: 'es2020',
  outfile: 'dist/Code.js',
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

copyFileSync('appsscript.json', 'dist/appsscript.json');
