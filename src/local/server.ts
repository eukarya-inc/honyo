// Run llama-server as a child process bound to 127.0.0.1 and talk to its
// OpenAI-compatible Completions API. The server is started on first use and
// stopped after a period of inactivity to give the model's memory back.

import { execFile, spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { readFile, writeFile, rm } from 'fs/promises';
import { createServer } from 'net';
import { join } from 'path';
import { PFML3_STOP } from './pfml3.ts';

const IDLE_STOP_MS = 30 * 60 * 1000;
const STARTUP_TIMEOUT_MS = 60 * 1000;
const CONTEXT_SIZE = 8192;
const MAX_OUTPUT_TOKENS = 4096;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() =>
        typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port')),
      );
    });
  });
}

/**
 * Stop a llama-server left behind by a previous run that ended without
 * cleanup (crash, killed terminal). Its PID is recorded in `pidFile`, and it
 * is only killed when that PID still runs this exact binary, so a reused PID
 * belonging to another program is never touched.
 */
async function reapStale(pidFile: string, serverBin: string): Promise<void> {
  let pid: number;
  try {
    pid = Number((await readFile(pidFile, 'utf8')).trim());
  } catch {
    return;
  }
  await rm(pidFile, { force: true });
  if (!Number.isInteger(pid) || pid <= 0 || process.platform === 'win32') return;
  const command = await new Promise<string>(resolve => {
    execFile('ps', ['-o', 'command=', '-p', String(pid)], (err, stdout) =>
      resolve(err ? '' : stdout.trim()),
    );
  });
  if (command.startsWith(serverBin)) {
    console.log(`Stopping stale llama-server (PID ${pid})`);
    try {
      process.kill(pid);
    } catch {
      // already gone
    }
  }
}

interface Running {
  child: ChildProcess;
  modelPath: string;
  url: string;
  apiKey: string;
  keyFile: string;
}

export class LocalServer {
  private running: Running | undefined;
  private starting: { modelPath: string; promise: Promise<Running> } | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  /** Every live child, including one still loading its model. */
  private readonly children = new Set<ChildProcess>();
  /** Bumped by stop(); a start begun before then gives up. */
  private epoch = 0;
  /** After shutDown() no new server is started. */
  private closed = false;

  private readonly serverBin: string;
  private readonly workDir: string;

  constructor(serverBin: string, workDir: string) {
    this.serverBin = serverBin;
    this.workDir = workDir;
  }

  private reaped = false;

  private get pidFile(): string {
    return join(this.workDir, 'llama-server.pid');
  }

  private async start(modelPath: string): Promise<Running> {
    if (this.closed) throw new Error('llama-server start cancelled: shutting down');
    const epoch = this.epoch;
    const stopped = (): boolean => this.epoch !== epoch;
    if (!this.reaped) {
      this.reaped = true;
      await reapStale(this.pidFile, this.serverBin);
    }
    const port = await freePort();
    const apiKey = randomBytes(24).toString('hex');
    // The key goes in a file, not argv, so other users can't read it from `ps`.
    const keyFile = join(this.workDir, `llama-server-${port}.key`);
    await writeFile(keyFile, apiKey + '\n', { mode: 0o600 });

    const args = [
      '-m',
      modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--api-key-file',
      keyFile,
      '-c',
      String(CONTEXT_SIZE),
      '--alias',
      'plamo-3-translate',
      '--no-webui',
      '--offline',
      '-np',
      '1',
    ];
    if (stopped()) throw new Error('llama-server start cancelled');
    const child = spawn(this.serverBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    this.children.add(child);
    let stderrTail = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-4000);
    });
    if (child.pid) void writeFile(this.pidFile, String(child.pid));
    child.on('exit', () => {
      this.children.delete(child);
      if (this.running?.child === child) this.running = undefined;
      void rm(keyFile, { force: true });
      void readFile(this.pidFile, 'utf8')
        .then(p => (p.trim() === String(child.pid) ? rm(this.pidFile, { force: true }) : undefined))
        .catch(() => {});
    });

    const url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (stopped()) {
        // stop() was called while the model loaded (e.g. the app quit).
        child.kill();
        throw new Error('llama-server start cancelled');
      }
      if (child.exitCode !== null) {
        throw new Error(`llama-server exited (${child.exitCode}):\n${stderrTail}`);
      }
      try {
        const res = await fetch(`${url}/health`);
        if (res.ok) return { child, modelPath, url, apiKey, keyFile };
      } catch {
        // not listening yet
      }
      await new Promise(r => setTimeout(r, 200));
    }
    child.kill();
    throw new Error(`llama-server did not become ready in time:\n${stderrTail}`);
  }

  private async ensure(modelPath: string): Promise<Running> {
    if (this.running && this.running.modelPath === modelPath) return this.running;
    if (this.running) this.stop();
    // Join a start already loading this model; otherwise start our own (a
    // start for another model finishes and is then replaced on next use).
    if (this.starting?.modelPath !== modelPath) {
      const promise = this.start(modelPath);
      const entry = { modelPath, promise };
      this.starting = entry;
      void promise
        .finally(() => {
          if (this.starting === entry) this.starting = undefined;
        })
        .catch(() => {});
    }
    const running = await this.starting.promise;
    if (this.running && this.running !== running) this.running.child.kill();
    this.running = running;
    return running;
  }

  /** True when the server is up with this model loaded. */
  isReady(modelPath: string): boolean {
    return this.running?.modelPath === modelPath;
  }

  /** Start the server and load the model ahead of the first translation. */
  async warmup(modelPath: string): Promise<void> {
    await this.ensure(modelPath);
    this.touch();
  }

  private touch(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), IDLE_STOP_MS);
    this.idleTimer.unref();
  }

  /** Stop for good (the app is quitting): also refuse any later start. */
  shutDown(): void {
    this.closed = true;
    this.stop();
  }

  /**
   * Stop the server, including one still loading its model, by killing the
   * child processes we spawned (by PID, via their handles).
   */
  stop(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    this.epoch++;
    for (const child of this.children) child.kill();
    this.running = undefined;
    this.starting = undefined;
  }

  /**
   * Run a raw completion for `prompt`. Streams text through `onDelta` and
   * resolves with the full output.
   */
  async complete(
    modelPath: string,
    prompt: string,
    onDelta?: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const srv = await this.ensure(modelPath);
    this.touch();
    try {
      const res = await fetch(`${srv.url}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${srv.apiKey}` },
        body: JSON.stringify({
          model: 'plamo-3-translate',
          prompt,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          stop: PFML3_STOP,
          stream: true,
        }),
        ...(signal ? { signal } : {}),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Local model request failed: HTTP ${res.status} ${await res.text()}`);
      }

      let out = '';
      let buf = '';
      const decoder = new TextDecoder();
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buf += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          const json = JSON.parse(data) as { choices?: Array<{ text?: string }> };
          const delta = json.choices?.[0]?.text ?? '';
          if (delta) {
            out += delta;
            onDelta?.(delta);
          }
        }
      }
      return out;
    } finally {
      this.touch();
    }
  }
}
