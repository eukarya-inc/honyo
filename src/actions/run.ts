// Runs an action end to end: pause check, cancellation of a previous run,
// tray icon, popup or notification output, and history. The keyboard trigger
// and future menu/shortcut entry points all go through here.
import { clipboard, Notification } from 'electron';
import { getConfig, getPausedState, getActiveProfileId } from '../config/index.ts';
import { setTrayIcon } from '../ui/tray.ts';
import {
  showTranslationPopup,
  closePopup,
  updatePopupTranslation,
  updatePopupLanguages,
  finalizePopupTranslation,
} from '../ui/popup.ts';
import { addHistoryEntry } from '../history/index.ts';
import { getAction } from './registry.ts';
import type { ActionInput, ActionMeta } from './types.ts';

let isRunning = false;
let currentAbortController: AbortController | null = null;

export function isActionRunning(): boolean {
  return isRunning;
}

export function cancelCurrentAction(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    console.log('Action cancelled');
    // Reset state immediately to allow new runs
    isRunning = false;
    setTrayIcon(false);
    currentAbortController = null;
  }
}

function summarizeInput(input: ActionInput): string {
  return input.kind === 'text' ? input.text : `[image ${input.png.byteLength} bytes]`;
}

/**
 * Execute the action with the given input and present the result according
 * to the display mode. Errors are shown to the user; nothing is thrown.
 */
export async function runAction(actionId: string, input: ActionInput): Promise<void> {
  const action = getAction(actionId);
  if (!action) {
    console.error(`Unknown action: ${actionId}`);
    return;
  }
  if (!action.accepts.includes(input.kind)) {
    console.log(`Action ${actionId} does not accept ${input.kind} input, ignoring`);
    return;
  }
  if (getPausedState()) {
    console.log('Honyo is paused, ignoring...');
    return;
  }
  if (isRunning) {
    console.log('Action already in progress, cancelling and starting new one...');
    cancelCurrentAction();
  }

  const abortController = new AbortController();
  const signal = abortController.signal;
  currentAbortController = abortController;
  isRunning = true;
  setTrayIcon(true);

  const config = getConfig();
  const usePopup = config.displayMode === 'popup';
  const streaming = usePopup && (config.enableStreaming ?? true);
  const inputSummary = summarizeInput(input);

  if (usePopup) showTranslationPopup(null, inputSummary);

  try {
    let meta: ActionMeta | undefined;
    const result = await action.run(input, {
      signal,
      streaming,
      ...(streaming ? { onChunk: (text: string): void => updatePopupTranslation(text) } : {}),
      onMeta: (m): void => {
        meta = m;
        if (usePopup && m.sourceLanguage && m.targetLanguage) {
          updatePopupLanguages(m.sourceLanguage, m.targetLanguage);
        }
      },
    });
    if (signal.aborted) return;

    if (usePopup) {
      if (streaming) {
        finalizePopupTranslation(result.text);
      } else {
        showTranslationPopup(result.text, inputSummary);
        if (meta?.sourceLanguage && meta.targetLanguage) {
          updatePopupLanguages(meta.sourceLanguage, meta.targetLanguage);
        }
      }
    } else {
      // Notification mode: copy to clipboard and show notification
      clipboard.writeText(result.text);
      new Notification({
        title: `${action.name} Result`,
        body: result.text.length > 100 ? result.text.slice(0, 100) + '...' : result.text,
      }).show();
    }

    if (config.historyEnabled !== false) {
      const finalMeta = result.meta ?? meta;
      addHistoryEntry({
        actionId: action.id,
        profileId: getActiveProfileId(),
        input: inputSummary,
        output: result.text,
        ...(finalMeta ? { meta: finalMeta } : {}),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`${action.name} was cancelled`);
      if (usePopup) closePopup();
      return;
    }
    console.error(`Error running ${action.name}:`, error);
    const message = error instanceof Error ? error.message : String(error);
    if (usePopup) closePopup();
    new Notification({
      title: `${action.name} Error`,
      body: message.length > 140 ? message.slice(0, 140) + '...' : message,
    }).show();
  } finally {
    // Only reset state if this is still the current run
    if (currentAbortController?.signal === signal) {
      isRunning = false;
      setTrayIcon(false);
      currentAbortController = null;
    }
  }
}
