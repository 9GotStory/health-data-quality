import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// The three versioned reference packs are static imports in the application bundle.
export function offlineApp(): Plugin {
  return {
    name: 'offline-inspection-app',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const assets = Object.values(bundle)
        .filter((file) => file.fileName === 'index.html' || /\.(js|css)$/.test(file.fileName))
        .map((file) => {
          const bytes = file.type === 'chunk' ? file.code : file.source;
          return [file.fileName, 'sha256-' + createHash('sha256').update(bytes).digest('base64')];
        });
      const manifest = JSON.stringify(assets);
      const revision = createHash('sha256').update(manifest).digest('hex');
      const worker = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'offline-worker.js',
        source: `const revision = ${JSON.stringify(revision)};\nconst assets = ${manifest};\n${worker}`,
      });
    },
  };
}
