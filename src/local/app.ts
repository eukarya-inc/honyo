// Electron glue for the local engine: where files live, and the download flow
// started from the tray (license consent -> download -> progress).

import { app, dialog, shell } from 'electron';
import { join } from 'path';
import { LOCAL_MODELS } from './catalog.ts';
import { installModel, installRuntime, isModelInstalled } from './runtime.ts';
import { parseLocalModelKey, stopLocalServer, warmupLocal } from './index.ts';
import { notify } from '../ui/notify.ts';

const LICENSE_URL = 'https://plamo.preferredai.jp/info/plamo-community-license-ja';

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
    void shell.openExternal(LICENSE_URL);
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
      onProgress?.(`${what === 'runtime' ? 'Runtime' : m.name}: ${pct}%`);
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
    onProgress?.('');
  }
}
