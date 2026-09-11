import { BrowserWindow, screen, ipcMain, clipboard, Menu, app } from 'electron';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { cancelCurrentTranslation } from '../keyboard/handler.ts';
import { getConfig, updateConfig } from '../config/index.ts';
import { translateTextDetailed } from '../translation/index.ts';

const DEFAULT_POPUP_WIDTH = 400;
const DEFAULT_POPUP_HEIGHT = 200;
const MIN_POPUP_WIDTH = 280;
const MIN_POPUP_HEIGHT = 160;

// Get __dirname in both ESM and CommonJS
const getCurrentDir = (): string => {
  if (typeof import.meta.url !== 'undefined') {
    // ESM
    return dirname(fileURLToPath(import.meta.url));
  } else {
    // CommonJS
    return __dirname;
  }
};

const currentDir = getCurrentDir();

let popupWindow: BrowserWindow | null = null;
let previousActiveApp: string | null = null;
// Language pair of the current translation. Kept here because it can be
// resolved while a freshly-created popup window is still loading — IPC sent
// before did-finish-load is dropped, so it is re-sent once the page is ready.
let pendingLanguages: { sourceLanguage: string; targetLanguage: string } | null = null;

// Send the current popup display config (read fresh so settings changes apply to
// the next popup without a restart).
function sendPopupConfig(): void {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  const config = getConfig();
  popupWindow.webContents.send('popup-config', {
    fontSize: config.popupFontSize ?? 14,
  });
}

// Resolve the initial popup size from config (persisted size, or the default),
// clamped to the minimum and the display work area.
function getInitialPopupSize(cursorPoint: { x: number; y: number }): {
  width: number;
  height: number;
} {
  const { popupSize } = getConfig();
  let width = popupSize?.width ?? DEFAULT_POPUP_WIDTH;
  let height = popupSize?.height ?? DEFAULT_POPUP_HEIGHT;

  const workArea = screen.getDisplayNearestPoint(cursorPoint).workAreaSize;
  width = Math.max(MIN_POPUP_WIDTH, Math.min(width, workArea.width));
  height = Math.max(MIN_POPUP_HEIGHT, Math.min(height, workArea.height));

  return { width, height };
}

// Persist the current popup size (fired once per manual resize via 'resized').
function savePopupSize(): void {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  const [width = DEFAULT_POPUP_WIDTH, height = DEFAULT_POPUP_HEIGHT] = popupWindow.getSize();
  updateConfig({ popupSize: { width, height } });
}

// Reset an open popup window to the default size (used by the settings reset).
export function resetPopupSize(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.setSize(DEFAULT_POPUP_WIDTH, DEFAULT_POPUP_HEIGHT);
  }
}

// Function to get the currently active application
function capturePreviousApp(): void {
  if (process.platform === 'darwin') {
    exec(
      'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'',
      (error, stdout) => {
        if (!error && stdout) {
          previousActiveApp = stdout.trim();
          console.log('Captured previous app:', previousActiveApp);
        }
      },
    );
  }
}

// Function to restore focus to the previous application
function restorePreviousApp(): void {
  if (process.platform === 'darwin' && previousActiveApp && previousActiveApp !== 'Electron') {
    exec(`osascript -e 'tell application "${previousActiveApp}" to activate'`, error => {
      if (error) {
        console.error('Failed to restore previous app:', error);
      } else {
        console.log('Restored focus to:', previousActiveApp);
      }
    });
    previousActiveApp = null;
  }
}

export function showTranslationPopup(translation: string | null, originalText: string): void {
  // A new translation cycle starts: its language pair is not known yet.
  pendingLanguages = null;

  // Get cursor position with DPI scaling consideration
  const cursorPoint = screen.getCursorScreenPoint();

  // Capture the previously active app before showing the popup
  if (!popupWindow || popupWindow.isDestroyed()) {
    capturePreviousApp();
  }

  // If popup exists, update content without repositioning
  if (popupWindow && !popupWindow.isDestroyed()) {
    // Apply current font size before updating content
    sendPopupConfig();

    // Update content
    if (translation === null) {
      popupWindow.webContents.send('translation-loading');
    } else {
      popupWindow.webContents.send('translation-data', {
        translation,
        originalText,
      });
    }

    // Focus the window
    popupWindow.focus();
    return;
  }

  // Create popup window (using the persisted size when available)
  const initialSize = getInitialPopupSize(cursorPoint);
  popupWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: MIN_POPUP_WIDTH,
    minHeight: MIN_POPUP_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: join(currentDir, '../../build/preload/popup.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Ensure window stays on top
  popupWindow.setAlwaysOnTop(true, 'floating');

  // Persist the size after a manual resize (fires once per drag on macOS)
  popupWindow.on('resized', savePopupSize);

  // Position the window
  repositionPopup(cursorPoint);

  // Load popup HTML
  const htmlPath = join(currentDir, '../../popup.html');
  void popupWindow.loadFile(htmlPath);

  // Send initial state once loaded
  popupWindow.webContents.once('did-finish-load', () => {
    sendPopupConfig();
    if (translation === null) {
      popupWindow?.webContents.send('translation-loading');
    } else {
      popupWindow?.webContents.send('translation-data', {
        translation,
        originalText,
      });
    }
    // Re-deliver the language pair if it resolved while the page was loading
    // (IPC sent before did-finish-load is dropped).
    if (pendingLanguages) {
      popupWindow?.webContents.send('translation-langs', pendingLanguages);
    }
  });

  // Add blur event handler based on user preference
  const config = getConfig();
  if (config.autoCloseOnBlur) {
    popupWindow.on('blur', () => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
      }
    });
  }

  popupWindow.on('closed', () => {
    // Restore focus to the previous application when popup closes
    restorePreviousApp();
    popupWindow = null;
  });
}

export function updatePopupTranslation(text: string): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('translation-chunk', text);
  }
}

export function updatePopupLanguages(sourceLanguage: string, targetLanguage: string): void {
  pendingLanguages = { sourceLanguage, targetLanguage };
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('translation-langs', pendingLanguages);
  }
}

export function finalizePopupTranslation(text: string): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('translation-complete', text);
  }
}

export function setupPopupIPC(): void {
  ipcMain.on('copy-translation', (event, text: string) => {
    clipboard.writeText(text);
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
    }
  });

  ipcMain.on('close-popup', () => {
    // Cancel any ongoing translation when closing popup
    cancelCurrentTranslation();
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
    }
  });

  ipcMain.on('back-translate', (event, text: string) => {
    void (async (): Promise<void> => {
      if (!popupWindow || popupWindow.isDestroyed() || !text) return;
      try {
        const config = getConfig();
        // The language-detection rules translate the translation back to the
        // source language automatically.
        const result = await translateTextDetailed(
          text,
          config.targetLanguage,
          config.secondaryLanguage,
        );
        if (!popupWindow || popupWindow.isDestroyed()) return;
        popupWindow.webContents.send('back-translation-result', {
          translation: result.translation,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
        });
      } catch (error) {
        if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.webContents.send(
            'back-translation-error',
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    })();
  });

  ipcMain.on(
    'show-context-menu',
    (event, data: { selectedText: string; hasSelection: boolean }) => {
      if (!popupWindow || popupWindow.isDestroyed()) return;

      const template = [];

      if (data.hasSelection) {
        template.push(
          {
            label: 'Copy',
            click: () => {
              clipboard.writeText(data.selectedText);
            },
          },
          { type: 'separator' as const },
        );
      }

      template.push({
        label: 'Copy All',
        click: () => {
          popupWindow?.webContents.send('copy-all-requested');
        },
      });

      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: popupWindow });
    },
  );
}

// Dev aid: HONYO_POPUP_SCREENSHOT=/path/out.png shows a sample translation,
// captures the popup once rendered, then quits (see main.ts).
export function debugCapturePopup(path: string): void {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  popupWindow.webContents.on('console-message', event => {
    console.log(`[popup:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
  });
  popupWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async (): Promise<void> => {
        const image = await popupWindow?.webContents.capturePage();
        if (image) writeFileSync(path, image.toPNG());
        app.quit();
      })();
    }, 1500);
  });
}

export function closePopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
}

function repositionPopup(cursorPoint: { x: number; y: number }): void {
  if (!popupWindow || popupWindow.isDestroyed()) return;

  const [width = DEFAULT_POPUP_WIDTH, height = DEFAULT_POPUP_HEIGHT] = popupWindow.getSize();
  const windowBounds = { width, height };

  // Get all displays to handle multi-monitor setups
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const displayBounds = currentDisplay.bounds;

  // Calculate position (center window on cursor)
  let x = cursorPoint.x - windowBounds.width / 2;
  let y = cursorPoint.y - windowBounds.height / 2;

  // Ensure popup doesn't go off-screen
  if (x + windowBounds.width > displayBounds.x + displayBounds.width) {
    x = displayBounds.x + displayBounds.width - windowBounds.width - 10;
  }
  if (y + windowBounds.height > displayBounds.y + displayBounds.height) {
    y = displayBounds.y + displayBounds.height - windowBounds.height - 10;
  }
  if (x < displayBounds.x) {
    x = displayBounds.x + 10;
  }
  if (y < displayBounds.y) {
    y = displayBounds.y + 10;
  }

  popupWindow.setPosition(Math.round(x), Math.round(y));
}
