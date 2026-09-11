import { clipboard, Notification } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { translateTextSafe, translateTextStreaming } from '../translation/index.ts';
import { getConfig, getPausedState } from '../config/index.ts';
import { copySelectionToClipboard } from './copy.ts';
import { setTrayIcon } from '../ui/tray.ts';
import {
  showTranslationPopup,
  closePopup,
  updatePopupTranslation,
  updatePopupLanguages,
  finalizePopupTranslation,
} from '../ui/popup.ts';

let isTranslating = false;
let t = 0;
let n = 0;
let currentAbortController: AbortController | null = null;

export interface TriggerOptions {
  /** Send a copy chord to the active app before reading the clipboard. */
  copySelectionFirst?: boolean;
}

/**
 * Run one translation of the clipboard (optionally copying the selection
 * first). Shared by the double-copy detector and custom global shortcuts.
 */
export async function triggerTranslation(options: TriggerOptions = {}): Promise<void> {
  // Ignore if paused
  if (getPausedState()) {
    console.log('Translation is paused, ignoring...');
    return;
  }

  // Cancel current translation if in progress
  if (isTranslating) {
    console.log('Translation already in progress, cancelling and starting new one...');
    cancelCurrentTranslation();
    // Don't return - continue with new translation
  }

  // Create new AbortController for this translation
  const abortController = new AbortController();

  try {
    const text = options.copySelectionFirst
      ? await copySelectionToClipboard()
      : clipboard.readText();
    console.log('Clipboard content:', text ? text.slice(0, 50) + '...' : '(empty)');

    if (!text) {
      return; // Do nothing
    }

    // Start translation
    isTranslating = true;
    setTrayIcon(true);

    const config = getConfig();

    // Set current abort controller
    currentAbortController = abortController;
    const signal = abortController.signal;

    // Show popup immediately with loading state if in popup mode
    if (config.displayMode === 'popup') {
      showTranslationPopup(null, text);
    }

    let translation: string;
    // Detected language pair (non-streaming path); streaming emits it
    // via the onLanguages callback below.
    let detectedLanguages: { source: string; target: string } | null = null;

    // Use streaming for popup mode if enabled
    if (config.displayMode === 'popup' && config.enableStreaming) {
      translation = await translateTextStreaming(
        text,
        config.targetLanguage,
        config.secondaryLanguage,
        (chunk: string) => {
          updatePopupTranslation(chunk);
        },
        signal,
        (source: string, target: string) => {
          updatePopupLanguages(source, target);
        },
      );
      // Notify that streaming is complete
      finalizePopupTranslation(translation);
    } else {
      const result = await translateTextSafe(
        text,
        config.targetLanguage,
        config.secondaryLanguage,
        signal,
      );
      translation = result.translation;
      if (result.sourceLanguage && result.targetLanguage) {
        detectedLanguages = {
          source: result.sourceLanguage,
          target: result.targetLanguage,
        };
      }
    }

    // Handle display mode
    if (config.displayMode === 'popup') {
      // Update popup window with final translation (in case streaming didn't run)
      if (!config.enableStreaming) {
        showTranslationPopup(translation, text);
        if (detectedLanguages) {
          updatePopupLanguages(detectedLanguages.source, detectedLanguages.target);
        }
      }
    } else {
      // Notification mode: copy to clipboard and show notification
      clipboard.writeText(translation);
      new Notification({
        title: 'Translation Result',
        body: translation.length > 100 ? translation.slice(0, 100) + '...' : translation,
      }).show();
    }
  } catch (error) {
    console.error('Error in translation process:', error);
    // Check if error is due to abortion
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Translation was cancelled');
      // Don't show error notification for cancelled translations
      // Also close popup if it's open
      const currentConfig = getConfig();
      if (currentConfig.displayMode === 'popup') {
        closePopup();
      }
    } else {
      new Notification({
        title: 'Translation Error',
        body: 'Failed to translate. Check console for details.',
      }).show();
    }
  } finally {
    // Translation complete - only reset state if this is still the current translation
    if (currentAbortController?.signal === abortController.signal) {
      isTranslating = false;
      setTrayIcon(false);
      currentAbortController = null;
    }
  }
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

export function cancelCurrentTranslation(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    console.log('Translation cancelled');
    // Reset state immediately to allow new translations
    isTranslating = false;
    setTrayIcon(false);
    currentAbortController = null;
  }
}

export function isCurrentlyTranslating(): boolean {
  return isTranslating;
}
