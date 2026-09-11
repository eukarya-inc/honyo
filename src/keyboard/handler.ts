import { clipboard } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { getConfig, getPausedState } from '../config/index.ts';
import { copySelectionToClipboard } from './copy.ts';
import { runAction, cancelCurrentAction, isActionRunning } from '../actions/run.ts';
import { TRANSLATE_ACTION_ID } from '../actions/translate.ts';

let t = 0;
let n = 0;

export interface TriggerOptions {
  /** Send a copy chord to the active app before reading the clipboard. */
  copySelectionFirst?: boolean;
}

/**
 * Translate the clipboard (optionally copying the selection first). Shared by
 * the double-copy detector and custom global shortcuts.
 */
export async function triggerTranslation(options: TriggerOptions = {}): Promise<void> {
  if (getPausedState()) {
    console.log('Translation is paused, ignoring...');
    return;
  }
  const text = options.copySelectionFirst ? await copySelectionToClipboard() : clipboard.readText();
  console.log('Clipboard content:', text ? text.slice(0, 50) + '...' : '(empty)');
  if (!text) return;
  await runAction(TRANSLATE_ACTION_ID, { kind: 'text', text });
}

export function setupKeyboardHandler(): void {
  uIOhook.on('keydown', e => {
    // The double-copy detector only acts when it is the configured trigger.
    if (getConfig().shortcuts?.translateTrigger === 'shortcut') return;

    const isC = e.keycode === UiohookKey.C;
    const meta = process.platform === 'darwin' ? e.metaKey : e.ctrlKey;
    if (!(isC && meta)) return;

    const now = Date.now();
    n = now - t < 800 ? n + 1 : 1;
    t = now;

    if (n === 2) {
      console.log('Double copy detected');
      n = 0;
      // Give the second Cmd+C a moment to land in the clipboard.
      setTimeout(() => void triggerTranslation(), 60);
    }
  });
}

export function startKeyboardListener(): void {
  try {
    uIOhook.start();
    console.log('Key listener started successfully');
  } catch (error) {
    console.error('Failed to start uIOhook:', error);
    throw error;
  }
}

export function stopKeyboardListener(): void {
  try {
    uIOhook.stop();
  } catch (error) {
    console.error('Error stopping uIOhook:', error);
  }
}

// Kept for existing callers (popup close, tray menu).
export function cancelCurrentTranslation(): void {
  cancelCurrentAction();
}

export function isCurrentlyTranslating(): boolean {
  return isActionRunning();
}
