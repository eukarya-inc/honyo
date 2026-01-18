import { clipboard, Notification } from 'electron';
import { uIOhook } from 'uiohook-napi';
import { translateText, translateTextStreaming } from '../translation/index.ts';
import { getConfig, getPausedState } from '../config/index.ts';
import { setTrayIcon } from '../ui/tray.ts';
import {
  showTranslationPopup,
  closePopup,
  updatePopupTranslation,
  finalizePopupTranslation,
} from '../ui/popup.ts';
import { matchesShortcut, getDefaultShortcut } from './shortcut.ts';

let isTranslating = false;
let t = 0;
let n = 0;
let currentAbortController: AbortController | null = null;

export function setupKeyboardHandler(): void {
  uIOhook.on('keydown', e => {
    const config = getConfig();
    const shortcut = config.shortcut ?? getDefaultShortcut();

    if (!matchesShortcut(e, shortcut)) return;

    // Handle double press detection
    if (shortcut.doublePress) {
      const now = Date.now();
      n = now - t < 800 ? n + 1 : 1;
      t = now;
      if (n !== 2) return;
      n = 0;
    }

    console.log('Shortcut triggered');

    // Ignore if paused
    if (getPausedState()) {
      console.log('Translation is paused, ignoring...');
      return;
    }

    // Cancel current translation if in progress
    if (isTranslating) {
      console.log('Translation already in progress, cancelling and starting new one...');
      cancelCurrentTranslation();
    }

    setTimeout(() => {
      void (async (): Promise<void> => {
        const abortController = new AbortController();

        try {
          const text = clipboard.readText();
          console.log('Clipboard content:', text ? text.slice(0, 50) + '...' : '(empty)');

          if (!text) return;

          isTranslating = true;
          setTrayIcon(true);

          const translationConfig = getConfig();
          currentAbortController = abortController;
          const signal = abortController.signal;

          if (translationConfig.displayMode === 'popup') {
            showTranslationPopup(null, text);
          }

          let translation: string;

          if (translationConfig.displayMode === 'popup' && translationConfig.enableStreaming) {
            translation = await translateTextStreaming(
              text,
              translationConfig.targetLanguage,
              translationConfig.secondaryLanguage,
              (chunk: string) => {
                updatePopupTranslation(chunk);
              },
              signal,
            );
            finalizePopupTranslation(translation);
          } else {
            translation = await translateText(
              text,
              translationConfig.targetLanguage,
              translationConfig.secondaryLanguage,
              signal,
            );
          }

          if (translationConfig.displayMode === 'popup') {
            if (!translationConfig.enableStreaming) {
              showTranslationPopup(translation, text);
            }
          } else {
            clipboard.writeText(translation);
            new Notification({
              title: 'Translation Result',
              body: translation.length > 100 ? translation.slice(0, 100) + '...' : translation,
            }).show();
          }
        } catch (error) {
          console.error('Error in translation process:', error);
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Translation was cancelled');
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
          // Only reset state if this is still the current translation
          if (currentAbortController?.signal === abortController.signal) {
            isTranslating = false;
            setTrayIcon(false);
            currentAbortController = null;
          }
        }
      })();
    }, 60);
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
