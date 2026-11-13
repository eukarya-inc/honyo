// A short chime when an action finishes (Settings -> General -> "Play a
// sound"), independent of the display mode. The tone is synthesized with Web
// Audio in a hidden window, so no sound file is shipped and it sounds the
// same on every OS.

import { BrowserWindow } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config/index.ts';

export type Chime = 'done' | 'error';

// This file's directory in both the ESM dev run and the CommonJS build
// (where import.meta.url is undefined), as in popup.ts.
const currentDir =
  typeof import.meta.url !== 'undefined' ? dirname(fileURLToPath(import.meta.url)) : __dirname;
const rootDir = join(currentDir, '../..');

let player: BrowserWindow | null = null;

function getPlayer(): BrowserWindow {
  if (player && !player.isDestroyed()) return player;
  player = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });
  player.on('closed', () => {
    player = null;
  });
  return player;
}

/** Play `chime` if sounds are enabled. */
export function playChime(chime: Chime): void {
  if (!getConfig().soundEnabled) return;
  // Reloading the page with the chime in the fragment plays it once.
  void getPlayer()
    .loadFile(join(rootDir, 'sound.html'), { hash: chime })
    .catch((error: unknown) => console.warn('Could not play sound:', error));
}
