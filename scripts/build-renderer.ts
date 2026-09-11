#!/usr/bin/env node

// Bundles the preload scripts and renderer bundles for the BrowserWindows.
// Unlike the main-process build (scripts/build.ts, which transpiles file by
// file), these must be single self-contained files: the renderer runs in an
// isolated browser context with no module resolution, and preload scripts are
// loaded by path. Runs on its own before `npm start` (dev) and as part of the
// full `npm run build`.

import esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildRenderer(): Promise<void> {
  await esbuild.build({
    entryPoints: [join(rootDir, 'src/preload/settings.ts')],
    bundle: true,
    // package.json is "type": "module", so a .js preload would be parsed as
    // ESM and `require` would be unavailable; .cjs forces CommonJS.
    outfile: join(rootDir, 'build/preload/settings.cjs'),
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    external: ['electron'],
    sourcemap: true,
  });

  await esbuild.build({
    entryPoints: [join(rootDir, 'src/renderer/settings/index.ts')],
    bundle: true,
    outfile: join(rootDir, 'build/renderer/settings.js'),
    format: 'iife',
    platform: 'browser',
    target: 'chrome140',
    sourcemap: true,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildRenderer()
    .then(() => console.log('Renderer/preload bundles built'))
    .catch(error => {
      console.error('Renderer build failed:', error);
      process.exit(1);
    });
}
