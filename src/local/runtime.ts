// Install the llama.cpp runtime (llama-server and its shared libraries) and
// the model files under one base directory, e.g. `<userData>/local-models`.
//
//   <base>/runtime/<build>/...       extracted release archive
//   <base>/models/<file>.gguf

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readdir, rename, rm } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import {
  getRuntimeDef,
  LOCAL_MODELS,
  modelUrl,
  runtimeUrl,
  type LocalModelDef,
  type RuntimeDef,
} from './catalog.ts';
import { download, type DownloadProgress } from './download.ts';

const execFileAsync = promisify(execFile);

const SERVER_BIN = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';

export function modelPath(base: string, m: LocalModelDef): string {
  return join(base, 'models', m.file);
}

function runtimeDir(base: string, r: RuntimeDef): string {
  return join(base, 'runtime', r.build);
}

async function findFile(dir: string, name: string): Promise<string | undefined> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return p;
    if (entry.isDirectory()) {
      const found = await findFile(p, name);
      if (found) return found;
    }
  }
  return undefined;
}

/** Path of the installed llama-server, or undefined when not installed. */
export async function findServerBinary(base: string): Promise<string | undefined> {
  const r = getRuntimeDef();
  if (!r) return undefined;
  const dir = runtimeDir(base, r);
  return existsSync(dir) ? findFile(dir, SERVER_BIN) : undefined;
}

export interface InstallOptions {
  signal?: AbortSignal;
  onProgress?: (what: 'runtime' | 'model', p: DownloadProgress) => void;
}

/** Download and extract llama-server for this platform. Returns its path. */
export async function installRuntime(base: string, opts: InstallOptions = {}): Promise<string> {
  const existing = await findServerBinary(base);
  if (existing) return existing;

  const r = getRuntimeDef();
  if (!r) throw new Error(`Local models are not supported on ${process.platform}-${process.arch}`);

  const archive = join(base, 'downloads', r.asset);
  await download({
    url: runtimeUrl(r),
    dest: archive,
    sha256: r.sha256,
    ...(opts.signal ? { signal: opts.signal } : {}),
    onProgress: p => opts.onProgress?.('runtime', p),
  });

  // Extract into a temp dir and rename, so a half-extracted runtime is never
  // mistaken for an installed one. bsdtar (macOS, Windows 10+) reads zip too.
  const dir = runtimeDir(base, r);
  const tmp = `${dir}.tmp`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await execFileAsync('tar', ['-xf', archive, '-C', tmp]);
  await rm(dir, { recursive: true, force: true });
  await rename(tmp, dir);
  await rm(archive, { force: true });

  const bin = await findServerBinary(base);
  if (!bin) throw new Error(`${SERVER_BIN} not found in ${r.asset}`);
  return bin;
}

/** Download a model file. Returns its path. */
export async function installModel(
  base: string,
  modelId: string,
  opts: InstallOptions = {},
): Promise<string> {
  const m = LOCAL_MODELS[modelId];
  if (!m) throw new Error(`Unknown local model: ${modelId}`);
  const dest = modelPath(base, m);
  await download({
    url: modelUrl(m),
    dest,
    sha256: m.sha256,
    size: m.size,
    ...(opts.signal ? { signal: opts.signal } : {}),
    onProgress: p => opts.onProgress?.('model', p),
  });
  return dest;
}

/** True when the model file is present (size check only; cheap enough for menus). */
export function isModelInstalled(base: string, modelId: string): boolean {
  const m = LOCAL_MODELS[modelId];
  return !!m && existsSync(modelPath(base, m));
}
