import { Tray } from 'electron';
import { createNormalIcon, createTranslatingIcon } from './icons.ts';
import { createTrayMenu, describeTranslateTrigger } from './menu.ts';
import { setMenuUpdateCallback } from '../app/updater.ts';
import { setModelsChangedCallback } from '../models-remote.ts';
import { setProfileChangedCallback } from '../config/index.ts';
import { onLocalStateChange } from '../local/index.ts';
import { notifySettingsProfilesChanged } from './settings.ts';

let tray: Tray | null = null;

let normalIcon: Electron.NativeImage | null = null;
let translatingIcon: Electron.NativeImage | null = null;

export function createTray(): Tray {
  // Create icons
  normalIcon = createNormalIcon();
  translatingIcon = createTranslatingIcon();

  if (!normalIcon) throw new Error('Normal icon not created');
  tray = new Tray(normalIcon);

  console.log('Tray created successfully');

  // Create menu update function
  const updateMenu = (): void => {
    if (tray) {
      const menu = createTrayMenu(tray, updateMenu);
      tray.setContextMenu(menu);
      // Dev aid: HONYO_DEBUG_MENU=1 logs the menu each time it is rebuilt.
      if (process.env.HONYO_DEBUG_MENU) logMenu(menu);
      tray.setToolTip(`Honyo - ${describeTranslateTrigger()} to translate`);
    }
  };

  // Register menu update callback for updater
  setMenuUpdateCallback(updateMenu);

  // Rebuild the menu when the fetched model list changes
  setModelsChangedCallback(updateMenu);

  // Rebuild the menu (and refresh an open settings window) on profile changes
  setProfileChangedCallback(() => {
    updateMenu();
    notifySettingsProfilesChanged();
  });

  // Rebuild the menu when the local model loads, unloads or downloads
  onLocalStateChange(updateMenu);

  // Create initial menu
  updateMenu();

  return tray;
}

export function getTray(): Tray | null {
  return tray;
}

export function setTrayIcon(isTranslating: boolean): void {
  if (!tray) return;

  if (isTranslating && translatingIcon) {
    tray.setImage(translatingIcon);
  } else if (normalIcon) {
    tray.setImage(normalIcon);
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function logMenu(menu: Electron.Menu, depth = 0): void {
  for (const item of menu.items) {
    if (item.type === 'separator') continue;
    const mark = item.checked ? '* ' : '';
    console.log(
      `[menu] ${'  '.repeat(depth)}${mark}${item.label}${item.enabled ? '' : ' (disabled)'}`,
    );
    if (item.submenu && depth < 1) logMenu(item.submenu, depth + 1);
  }
  if (depth === 0) console.log('[menu] ----');
}
