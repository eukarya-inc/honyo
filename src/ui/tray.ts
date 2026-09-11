import { Tray } from 'electron';
import { createNormalIcon, createTranslatingIcon } from './icons.ts';
import { createTrayMenu } from './menu.ts';
import { setMenuUpdateCallback } from '../app/updater.ts';
import { setModelsChangedCallback } from '../models-remote.ts';
import { setProfileChangedCallback, getConfig } from '../config/index.ts';
import { formatAccelerator } from '../keyboard/accelerator.ts';
import { notifySettingsProfilesChanged } from './settings.ts';

let tray: Tray | null = null;

function describeTrigger(): string {
  const shortcuts = getConfig().shortcuts;
  if (shortcuts?.translateTrigger === 'shortcut' && shortcuts.translateShortcut) {
    return formatAccelerator(shortcuts.translateShortcut, process.platform);
  }
  return process.platform === 'darwin' ? 'Double Cmd+C' : 'Double Ctrl+C';
}
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
      tray.setToolTip(`Honyo - ${describeTrigger()} to translate`);
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
