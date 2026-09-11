#!/usr/bin/env node

// NOTE: This build process is temporary until Electron supports Node v24+
// When Electron supports Node v24+ (where TypeScript support is built-in), we can:
// 1. Remove this entire scripts/ directory
// 2. Remove the "build" script from package.json
// 3. Change "dist" script back to just "electron-builder"
// 4. Use src/*.ts files directly without compilation

import esbuild from 'esbuild';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync, rmSync } from 'fs';
import { buildRenderer } from './build-renderer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Clean build directory
const buildDir = join(rootDir, 'build');
if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}

// Find all TypeScript files recursively
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Renderer and preload sources are bundled separately (build-renderer.ts).
      if (entry === 'renderer' || entry === 'preload') continue;
      findTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const entryPoints = findTsFiles(join(rootDir, 'src'));

console.log('Building with esbuild...');

try {
  await esbuild.build({
    entryPoints,
    bundle: false, // Keep individual files
    outdir: 'build',
    // Must use CommonJS format for compatibility with @electron/universal
    // which generates a CommonJS index.js file that cannot work with ES modules
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    resolveExtensions: ['.ts', '.js'],
    loader: {
      '.ts': 'ts'
    },
    // Remove plugins for now
  });
  
  console.log('Build completed successfully with esbuild!');
  
  // Fix imports with .ts extensions
  console.log('Fixing import extensions...');
  await fixImports(buildDir);
  console.log('Import extensions fixed!');

  await buildRenderer();
  console.log('Renderer/preload bundles built!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Function to fix .ts extensions in imports
async function fixImports(dir: string): Promise<void> {
  const { readdir, readFile, writeFile } = await import('fs/promises');
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = join(dir, file.name);
    
    if (file.isDirectory()) {
      await fixImports(fullPath);
    } else if (file.name.endsWith('.js')) {
      let content = await readFile(fullPath, 'utf-8');
      // Fix imports with .ts extensions
      content = content.replace(/from\s+["'](.+?)\.ts["']/g, 'from "$1.js"');
      content = content.replace(/import\s*\(\s*["'](.+?)\.ts["']\s*\)/g, 'import("$1.js")');
      // Fix require statements with .ts extensions (for CommonJS)
      content = content.replace(/require\s*\(\s*["'](.+?)\.ts["']\s*\)/g, 'require("$1.js")');
      await writeFile(fullPath, content);
    }
  }
}