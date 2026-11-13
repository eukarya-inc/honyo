import { chmodSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LocalServer } from './server.ts';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe.skipIf(process.platform === 'win32')('LocalServer.stop', () => {
  it('kills a server that is still loading its model', async () => {
    // Stand-in for llama-server that never becomes healthy.
    const dir = mkdtempSync(join(tmpdir(), 'honyo-server-'));
    const bin = join(dir, 'fake-llama-server');
    writeFileSync(bin, '#!/bin/sh\necho $$ > "$(dirname "$0")/child.pid"\nexec sleep 30\n');
    chmodSync(bin, 0o755);

    const srv = new LocalServer(bin, dir);
    const warmup = srv.warmup(join(dir, 'model.gguf'));
    const result = warmup.then(
      () => 'ready',
      (e: unknown) => String(e),
    );

    let pid = 0;
    for (let i = 0; i < 50 && !pid; i++) {
      await new Promise(r => setTimeout(r, 50));
      try {
        pid = Number((await import('fs')).readFileSync(join(dir, 'child.pid'), 'utf8'));
      } catch {
        // not spawned yet
      }
    }
    expect(pid).toBeGreaterThan(0);
    expect(isAlive(pid)).toBe(true);

    srv.stop();

    expect(await result).toContain('cancelled');
    for (let i = 0; i < 20 && isAlive(pid); i++) await new Promise(r => setTimeout(r, 50));
    expect(isAlive(pid)).toBe(false);
  });
});
