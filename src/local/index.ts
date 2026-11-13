// Local translation engine facade. Electron-free: the caller passes the base
// directory (the app uses `<userData>/local-models`), so the spike script can
// drive the same code from plain Node.

import { DEFAULT_LOCAL_MODEL, LOCAL_MODELS } from './catalog.ts';
import { pickDirection } from '../language/detect.ts';
import { buildPfml3Prompt, plamoLanguageCode } from './pfml3.ts';
import { findServerBinary, isModelInstalled, modelPath } from './runtime.ts';
import { LocalServer } from './server.ts';

export { LOCAL_MODELS, DEFAULT_LOCAL_MODEL } from './catalog.ts';
export { installModel, installRuntime, isModelInstalled } from './runtime.ts';

export const LOCAL_MODEL_PREFIX = 'local:';

/** `local:<id>` -> `<id>` when it names a known local model. */
export function parseLocalModelKey(key: string): string | undefined {
  if (!key.startsWith(LOCAL_MODEL_PREFIX)) return undefined;
  const id = key.slice(LOCAL_MODEL_PREFIX.length);
  return LOCAL_MODELS[id] ? id : undefined;
}

export interface LocalTranslation {
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
}

// One server per base directory. The promise is cached so concurrent callers
// (launch warm-up and the first translation) share one instance; two would
// each start a process and the untracked one would outlive the app.
let server: { base: string; srv: Promise<LocalServer>; ready?: LocalServer } | undefined;

export type LocalEngineState =
  { state: 'stopped' } | { state: 'loading' | 'ready'; modelId: string | undefined };

const stateListeners: Array<() => void> = [];

/** Subscribe to local engine state changes (loading, ready, stopped). */
export function onLocalStateChange(listener: () => void): void {
  stateListeners.push(listener);
}

/** Also used for download progress, which the same status line shows. */
export function notifyState(): void {
  for (const listener of stateListeners) listener();
}

/** What the local engine is doing now, for status displays. */
export function localEngineState(): LocalEngineState {
  const s = server?.ready?.state() ?? { state: 'stopped' as const };
  if (s.state === 'stopped') {
    // Looking up the runtime counts as loading too.
    if (server && !server.ready && !shutDown) return { state: 'loading', modelId: undefined };
    return s;
  }
  const modelId = Object.values(LOCAL_MODELS).find(m => s.modelPath.endsWith(m.file))?.id;
  return { state: s.state, modelId };
}

// Set when the app quits: no server may start after that, even one whose
// start was already on its way (the launch warm-up).
let shutDown = false;

function getServer(base: string): Promise<LocalServer> {
  if (shutDown) return Promise.reject(new Error('Honyo is quitting'));
  if (server?.base === base) return server.srv;
  const previous = server?.srv;
  const srv = (async (): Promise<LocalServer> => {
    (await previous?.catch(() => undefined))?.stop();
    const bin = await findServerBinary(base);
    if (!bin) throw new Error('Local runtime is not installed');
    const srv = new LocalServer(bin, base);
    srv.onStateChange = notifyState;
    if (shutDown) srv.shutDown();
    return srv;
  })();
  const entry: { base: string; srv: Promise<LocalServer>; ready?: LocalServer } = { base, srv };
  server = entry;
  void srv
    .then(s => {
      entry.ready = s;
      notifyState();
    })
    .catch(() => notifyState());
  // Let a failed lookup (runtime not installed yet) be retried next time.
  srv.catch(() => {
    if (server === entry) server = undefined;
  });
  return srv;
}

/**
 * Stop the server. Synchronous once it exists, so it also works right before
 * `app.exit()`, which skips the asynchronous rest of the event loop.
 */
export function stopLocalServer(): void {
  if (server?.ready) server.ready.stop();
  else void server?.srv.then(srv => srv.stop()).catch(() => {});
}

/** Stop the server for good: the app is quitting. */
export function shutDownLocalServer(): void {
  shutDown = true;
  if (server?.ready) server.ready.shutDown();
  else void server?.srv.then(srv => srv.shutDown()).catch(() => {});
}

/** Load the model now so the first translation does not wait for it. */
export async function warmupLocal(base: string, modelId: string): Promise<void> {
  const m = LOCAL_MODELS[modelId];
  if (!m || !isModelInstalled(base, modelId)) return;
  await (await getServer(base)).warmup(modelPath(base, m));
}

export async function translateLocal(
  base: string,
  text: string,
  primaryLanguage: string,
  secondaryLanguage: string,
  opts: {
    modelId?: string;
    onChunk?: (translationSoFar: string) => void;
    onLanguages?: (source: string, target: string) => void;
    /** Progress message while the model is loading (not called when warm). */
    onStatus?: (message: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<LocalTranslation> {
  const modelId = opts.modelId ?? DEFAULT_LOCAL_MODEL;
  const m = LOCAL_MODELS[modelId];
  if (!m) throw new Error(`Unknown local model: ${modelId}`);
  if (!isModelInstalled(base, modelId)) throw new Error(`${m.name} is not downloaded`);

  const { source: sourceLanguage, target: targetLanguage } = pickDirection(
    text,
    primaryLanguage,
    secondaryLanguage,
  );
  const targetCode = plamoLanguageCode(targetLanguage);
  if (!targetCode) throw new Error(`${targetLanguage} is not supported by ${m.name}`);
  // Only the target is certain; the source is a guess when it isn't primary.
  opts.onLanguages?.(sourceLanguage, targetLanguage);

  const srv = await getServer(base);
  if (!srv.isReady(modelPath(base, m))) opts.onStatus?.(`Loading ${m.name}…`);
  let soFar = '';
  const raw = await srv.complete(
    modelPath(base, m),
    buildPfml3Prompt(text, targetCode),
    delta => {
      soFar += delta;
      opts.onChunk?.(soFar);
    },
    opts.signal,
  );
  return { translation: raw.trim(), sourceLanguage, targetLanguage };
}
