// One way to tell the user something: the OS notification, or Honyo's own
// toast window when the OS one can't be shown. Since Electron 42, macOS only
// shows notifications for code-signed apps (UNNotification); an unsigned
// Honyo gets a `failed` event and nothing on screen.
//
// Settings -> General -> Notifications picks the style:
//   auto   - OS notification, falling back to the toast once it fails
//   system - OS notification only
//   app    - Honyo's toast only

import { BrowserWindow, Notification, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config/index.ts';
import type { NotificationStyle } from '../config/types.ts';

export interface Notice {
  title: string;
  body: string;
}

const TOAST_WIDTH = 360;
const TOAST_HEIGHT = 92;
const TOAST_MARGIN = 16;
const TOAST_MS = 6000;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

let toast: BrowserWindow | null = null;
let hideTimer: NodeJS.Timeout | undefined;

// Set once an OS notification has failed this session, so `auto` goes
// straight to the toast instead of failing every time.
let systemFailed = false;

function toastBounds(): Electron.Rectangle {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const x = workArea.x + workArea.width - TOAST_WIDTH - TOAST_MARGIN;
  // macOS shows notifications top-right; Windows and most Linux desktops
  // bottom-right, next to the tray.
  const y =
    process.platform === 'darwin'
      ? workArea.y + TOAST_MARGIN
      : workArea.y + workArea.height - TOAST_HEIGHT - TOAST_MARGIN;
  return { x, y, width: TOAST_WIDTH, height: TOAST_HEIGHT };
}

/** Show Honyo's own toast (replacing one that is still on screen). */
export function showToast({ title, body }: Notice): void {
  if (!toast || toast.isDestroyed()) {
    toast = new BrowserWindow({
      ...toastBounds(),
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: false,
      // A non-activating panel on macOS: showing it must not take focus from
      // the popup (which closes on blur) or from the app the user is in.
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    toast.setAlwaysOnTop(true, 'screen-saver');
    toast.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    toast.on('closed', () => {
      toast = null;
    });
    // The page closes itself on click by navigating to #close.
    toast.webContents.on('did-navigate-in-page', (_e, url) => {
      if (url.endsWith('#close')) toast?.close();
    });
  } else {
    toast.setBounds(toastBounds());
  }

  const win = toast;
  // The content travels in the URL fragment: the page needs no preload/IPC.
  void win
    .loadFile(join(rootDir, 'toast.html'), {
      hash: encodeURIComponent(JSON.stringify({ title, body })),
    })
    .then(() => {
      if (!win.isDestroyed()) win.showInactive();
    });

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!win.isDestroyed()) win.close();
  }, TOAST_MS);
}

/** Dev aid: write the toast as it looks right now to `path` (PNG). */
export async function captureToastTo(path: string): Promise<boolean> {
  if (!toast || toast.isDestroyed()) return false;
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(path, (await toast.webContents.capturePage()).toPNG());
    return true;
  } catch (error) {
    console.warn(`Could not capture the toast to ${path}:`, error);
    return false;
  }
}

function showSystem(notice: Notice, onFailed?: () => void): void {
  // Silent: Honyo plays its own sound (Settings -> General), in every mode.
  const n = new Notification({ title: notice.title, body: notice.body, silent: true });
  n.on('failed', (_e, error) => {
    console.warn('System notification failed:', error);
    onFailed?.();
  });
  n.show();
}

export function notify(notice: Notice): void {
  const style: NotificationStyle = getConfig().notificationStyle ?? 'auto';
  if (style === 'app') return showToast(notice);
  if (style === 'system') return showSystem(notice);

  if (systemFailed || !Notification.isSupported()) return showToast(notice);
  showSystem(notice, () => {
    systemFailed = true;
    showToast(notice);
  });
}
