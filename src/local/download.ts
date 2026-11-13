// Resumable, checksum-verified download. Writes to `<dest>.part`, resumes it
// with a Range request, and renames into place only after the SHA-256 matches.

import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rename, rm, stat } from 'fs/promises';
import { dirname } from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { pipeline } from 'stream/promises';

export interface DownloadProgress {
  received: number;
  total: number;
}

export interface DownloadOptions {
  url: string;
  dest: string;
  sha256: string;
  /** Expected size in bytes, used for progress before the server answers. */
  size?: number;
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/** True when `dest` already exists with the expected checksum. */
export async function isDownloaded(dest: string, sha256: string): Promise<boolean> {
  if ((await fileSize(dest)) === 0) return false;
  return (await sha256File(dest)) === sha256;
}

export async function download(opts: DownloadOptions): Promise<void> {
  const { url, dest, sha256, signal, onProgress } = opts;
  if (await isDownloaded(dest, sha256)) return;

  await mkdir(dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  let offset = await fileSize(part);

  const res = await fetch(url, {
    headers: offset > 0 ? { Range: `bytes=${offset}-` } : {},
    redirect: 'follow',
    ...(signal ? { signal } : {}),
  });
  if (res.status === 416) {
    // The partial file is already complete (or bogus): verify below.
  } else if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  } else {
    if (offset > 0 && res.status !== 206) offset = 0; // server ignored Range
    const length = Number(res.headers.get('content-length') ?? 0);
    const total = length > 0 ? offset + length : (opts.size ?? 0);
    let received = offset;

    const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length;
      onProgress?.({ received, total });
    });
    await pipeline(body, createWriteStream(part, { flags: offset > 0 ? 'a' : 'w' }), {
      ...(signal ? { signal } : {}),
    });
  }

  const actual = await sha256File(part);
  if (actual !== sha256) {
    await rm(part, { force: true });
    throw new Error(`Checksum mismatch for ${url}: expected ${sha256}, got ${actual}`);
  }
  await rename(part, dest);
}
