// Electron glue for the local engine: where files live, and the download flow
// started from the tray (license consent -> download -> progress).

import { PLAMO_LICENSE_URL } from './credit.ts';
import { getConfig, notifyConfigChanged, updateConfig } from '../config/index.ts';
import { app, dialog, shell } from 'electron';
import { join } from 'path';
import { LOCAL_MODELS } from './catalog.ts';
import { installModel, installRuntime, isModelInstalled } from './runtime.ts';
import {
  LOCAL_MODEL_PREFIX,
  localEngineState,
  notifyState,
  parseLocalModelKey,
  stopLocalServer,
  warmupLocal,
} from './index.ts';
import { modelPath } from './runtime.ts';
import { mkdir, rm } from 'fs/promises';
import { DEFAULT_MODEL_KEY } from '../models.ts';
import { notify } from '../ui/notify.ts';

export function localBaseDir(): string {
  return join(app.getPath('userData'), 'local-models');
}

export function isLocalModelReady(modelId: string): boolean {
  return isModelInstalled(localBaseDir(), modelId);
}

/**
 * Keep the llama-server in step with the selected model: load a local model
 * as soon as it is selected (or at launch), and free its memory when the
 * selection moves to a cloud model.
 */
export function syncLocalServer(aiModel: string): void {
  const id = parseLocalModelKey(aiModel);
  if (!id) {
    stopLocalServer();
    return;
  }
  warmupLocal(localBaseDir(), id).catch((error: unknown) => {
    console.error('Local model warm-up failed:', error);
  });
}

let inFlight: AbortController | undefined;
let downloadStatus = '';

/** e.g. "PLaMo 3 Translate 2B (Local): 45%" while a download runs, else "". */
export function localDownloadStatus(): string {
  return downloadStatus;
}

export function isLocalDownloadRunning(): boolean {
  return !!inFlight;
}

export function cancelLocalDownload(): void {
  inFlight?.abort();
}

/**
 * Ask for license consent, then download llama-server and the model.
 * Resolves true when the model is ready to use.
 */
export async function downloadLocalModel(
  modelId: string,
  onProgress?: (label: string) => void,
): Promise<boolean> {
  const m = LOCAL_MODELS[modelId];
  if (!m || inFlight) return false;

  const sizeGb = (m.size / 1e9).toFixed(1);
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: `Download ${m.name}?`,
    detail:
      `About ${sizeGb} GB is downloaded from Hugging Face, together with the llama.cpp runtime. ` +
      'Translation then runs on this computer and text is not sent to any API.\n\n' +
      'The model is provided by Preferred Networks under the PLaMo Community License. ' +
      'Commercial use requires registration with PFN (free up to 1 billion yen in revenue).',
    buttons: ['Agree and Download', 'Cancel', 'View License'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 2) {
    void shell.openExternal(PLAMO_LICENSE_URL);
    return false;
  }
  if (response !== 0) return false;

  inFlight = new AbortController();
  const base = localBaseDir();
  try {
    let last = -1;
    const progress = (what: 'runtime' | 'model', p: { received: number; total: number }): void => {
      const pct = p.total ? Math.floor((p.received / p.total) * 100) : 0;
      if (pct === last) return;
      last = pct;
      downloadStatus = `${what === 'runtime' ? 'llama.cpp runtime' : m.name}: ${pct}%`;
      onProgress?.(downloadStatus);
      notifyState();
    };
    await installRuntime(base, { signal: inFlight.signal, onProgress: progress });
    last = -1;
    await installModel(base, modelId, { signal: inFlight.signal, onProgress: progress });
    notify({ title: 'Local model ready', body: `${m.name} is ready to use.` });
    return true;
  } catch (error) {
    if (!inFlight.signal.aborted) {
      console.error('Local model download failed:', error);
      notify({
        title: 'Download failed',
        body: error instanceof Error ? error.message : String(error),
      });
    }
    return false;
  } finally {
    inFlight = undefined;
    downloadStatus = '';
    onProgress?.('');
    notifyState();
  }
}

/** Open the folder holding the downloaded models in Finder / Explorer. */
export async function revealLocalModels(): Promise<void> {
  const dir = join(localBaseDir(), 'models');
  await mkdir(dir, { recursive: true });
  const error = await shell.openPath(dir);
  if (error) console.error('Could not open the models folder:', error);
}

/**
 * Delete a downloaded model after confirmation. A profile using it falls back
 * to the default model; with no model left, the runtime is removed too.
 */
export async function deleteLocalModel(modelId: string): Promise<boolean> {
  const m = LOCAL_MODELS[modelId];
  if (!m || !isLocalModelReady(modelId)) return false;
  const others = Object.values(LOCAL_MODELS).filter(
    o => o.id !== modelId && isLocalModelReady(o.id),
  );
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: `Delete ${m.name}?`,
    detail:
      `This frees about ${(m.size / 1e9).toFixed(1)} GB. You can download it again from the tray.` +
      (others.length
        ? ''
        : ' The llama.cpp runtime is removed as well, as no other local model uses it.'),
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) return false;

  const key = LOCAL_MODEL_PREFIX + modelId;
  if (getConfig().aiModel === key) updateConfig({ aiModel: DEFAULT_MODEL_KEY });
  // The server may have this file open; stop it before removing it.
  if (localEngineState().state !== 'stopped') stopLocalServer();

  const base = localBaseDir();
  const file = modelPath(base, m);
  await rm(file, { force: true });
  await rm(`${file}.part`, { force: true });
  if (!others.length) await rm(join(base, 'runtime'), { recursive: true, force: true });
  notifyState();
  notifyConfigChanged();
  return true;
}

export function openPlamoLicense(): void {
  void shell.openExternal(PLAMO_LICENSE_URL);
}

/**
 * The first translation with a local model: say once where the model comes
 * from and under which license, with a click to read it.
 */
export function noteLocalModelUsed(): void {
  if (getConfig().plamoNoticeShown) return;
  updateConfig({ plamoNoticeShown: true });
  notify({
    title: 'Built with PLaMo',
    body: 'Local translation uses PLaMo 3 Translate by Preferred Networks under the PLaMo Community License. Click to read it.',
    onClick: openPlamoLicense,
  });
}
